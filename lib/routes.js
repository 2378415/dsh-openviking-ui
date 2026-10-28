/**
 * HTTP surface of the plugin, under `/dsh-openviking-ui/api`.
 *
 * Every route runs the Host's own trust gate first (`ctx.connection
 * .requestRejection`: its Host/Origin fence plus the browser login the page
 * already carries). A host without that service falls back to a loopback +
 * same-origin fence, which is what a plain `dsh web` deployment needs.
 *
 * Responses carry status, counts and masked credentials only. The API key
 * never leaves the Host: `test` accepts an optional key but the UI omits it to
 * probe with the live resolved credential.
 */

const PREFIX = '/dsh-openviking-ui/api';
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function loopbackFence(request) {
  if (request.headers['sec-fetch-site'] === 'cross-site') return 403;
  const host = String(request.headers.host || '');
  if (!host) return undefined;
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  return LOOPBACK.has(name.toLowerCase()) ? undefined : 403;
}

function rejectionOf(ctx, request) {
  const connection = ctx.get('connection');
  if (connection && typeof connection.requestRejection === 'function') {
    try {
      return connection.requestRejection(request) ?? undefined;
    } catch {
      return 403;
    }
  }
  return loopbackFence(request);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(parsed && typeof parsed === 'object' ? parsed : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function warn(ctx, message) {
  try {
    const logger = typeof ctx.logger === 'function' ? ctx.logger('openviking-ui') : ctx.logger;
    if (logger && typeof logger.warn === 'function') logger.warn(message);
  } catch {
    // Logging is a nicety, never a dependency.
  }
}

/** Build the GET/POST wrappers and the trust gate over one hub. */
function tools(ctx, hub) {
  const guard = (handler) => (request, response) => {
    try {
      hub.noteClientRequest();
    } catch {
      // Counting is a diagnostic, not a gate.
    }
    const status = rejectionOf(ctx, request);
    if (status !== undefined) {
      sendJson(response, status, { ok: false, error: status === 401 ? 'login_required' : 'untrusted_request' });
      return undefined;
    }
    return handler(request, response);
  };

  const get = (handler) => guard(async (request, response) => {
    if (request.method !== 'GET') {
      sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }
    try {
      sendJson(response, 200, await handler());
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const post = (handler) => guard(async (request, response) => {
    if (request.method !== 'POST') {
      sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }
    const type = String(request.headers['content-type'] || '').toLowerCase();
    if (!type.startsWith('application/json')) {
      sendJson(response, 415, { ok: false, error: 'json_required' });
      return;
    }
    let body;
    try {
      body = await readJson(request);
    } catch {
      sendJson(response, 400, { ok: false, error: 'invalid_json' });
      return;
    }
    try {
      sendJson(response, 200, await handler(body));
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return { guard, get, post };
}

function stream(hub, request, response) {
  if (request.method !== 'GET') {
    sendJson(response, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }
  response.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  if (typeof response.flushHeaders === 'function') response.flushHeaders();

  let closed = false;
  const write = (event, data) => {
    if (closed) return;
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    // A compressing carrier buffers small writes; flush when it exposes one,
    // otherwise the browser never sees the frame and drops the stream.
    if (typeof response.flush === 'function') response.flush();
  };

  write('snapshot', hub.snapshot());
  const unsubscribe = hub.subscribe((frame) => {
    if (frame.sessionId && frame.view) {
      write('session', { rev: frame.rev, sessionId: frame.sessionId, view: frame.view });
      return;
    }
    write('pending', { rev: frame.rev, pending: hub.pending });
  });
  const heartbeat = setInterval(() => {
    if (closed) return;
    response.write(': ping\n\n');
    if (typeof response.flush === 'function') response.flush();
  }, 20000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };
  request.on('close', close);
  request.on('error', close);
  response.on('close', close);
}

/**
 * Register every route; returns one disposer for all of them.
 * @param ctx - host context carrying `webServer`.
 * @param hub - state hub.
 */
export function registerRoutes(ctx, hub) {
  const { guard, get, post } = tools(ctx, hub);
  const routes = [
    { path: `${PREFIX}/ping`, handler: get(async () => ({ ok: true, version: '1.0.0' })) },
    {
      path: `${PREFIX}/status`,
      handler: get(async () => {
        await hub.refreshPending().catch(() => {});
        return { ok: true, ...hub.snapshot() };
      }),
    },
    { path: `${PREFIX}/stream`, handler: guard((request, response) => stream(hub, request, response)) },
    {
      path: `${PREFIX}/pending`,
      handler: get(async () => {
        const pending = await hub.refreshPending();
        return { ok: true, ...hub.pendingView(), entries: pending.entries.length };
      }),
    },
    {
      path: `${PREFIX}/stats`,
      handler: get(async () => ({ ok: true, stats: hub.statsView(), pending: hub.pendingView() })),
    },
    {
      path: `${PREFIX}/stats/reset`,
      handler: post(async () => ({ ok: true, stats: await hub.resetStats() })),
    },
    {
      path: `${PREFIX}/config`,
      handler: post(async (body) => {
        const result = await hub.config.save(body);
        return { ok: result.ok, ...result };
      }),
    },
    {
      path: `${PREFIX}/config/reset`,
      handler: post(async () => {
        const result = await hub.config.reset();
        return { ok: result.ok, ...result };
      }),
    },
    {
      path: `${PREFIX}/config/test`,
      handler: post(async (body) => {
        const result = await hub.config.test(body);
        return { ok: result.ok, ...result };
      }),
    },
  ];

  const disposers = [];
  for (const route of routes) {
    try {
      disposers.push(ctx.webServer.register({ kind: 'exact', path: route.path, handler: route.handler }));
    } catch (error) {
      warn(ctx, `route ${route.path} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return () => {
    for (const dispose of disposers) {
      try {
        dispose();
      } catch {
        // Already gone with the server.
      }
    }
  };
}
