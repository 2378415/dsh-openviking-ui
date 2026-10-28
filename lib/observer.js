/**
 * Observe the OpenViking memory plugin without modifying it.
 *
 * Two facts are needed for an honest per-turn status:
 *   1. what the target plugin actually sent (and what came back), and
 *   2. whether the local pending queue took a failed write instead.
 *
 * (1) is captured by wrapping the live `openvikingMemory.client.fetchJSON`.
 * Every write the target plugin makes -- a live capture, a commit, or a
 * pending-queue replay of either -- goes through that one function, so the
 * counters see replays as successes instead of watching the queue drain
 * without a matching win. The wrapper is transparent: same `this`, same return
 * value, same rejection, and it restores itself on unload. If the service or
 * the method is missing (older/newer target release), the observer records
 * nothing and the queue scan in (2) still reports queued work.
 *
 * Turn boundaries come from `session/event`, which is the same channel the
 * target plugin uses to decide its own commits. The turn record stays open for
 * a short settle window so writes that finish just after `turn/end` still land
 * on the right turn.
 */

import { scanPending } from './pending.js';

const SETTLE_MS = 1500;
const SETTLE_FALLBACK_MS = 700;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionIdOf(session) {
  const id = session?.id;
  return typeof id === 'string' ? id : (id === undefined || id === null ? '' : String(id));
}

function turnNumberOf(event) {
  const turn = Number(event?.data?.turn);
  return Number.isFinite(turn) ? turn : 0;
}

/**
 * Install the observer on the context that carries `openvikingMemory`.
 * @param scoped - context with `openvikingMemory` available.
 * @param hub - ledger/publish hub from `createHub`.
 */
export function installObserver(scoped, hub) {
  const memory = scoped.openvikingMemory;
  const ledger = hub.ledger;

  function ovIdFor(sessionId) {
    const states = memory?.states;
    if (states && typeof states.get === 'function') {
      const state = states.get(sessionId);
      if (state?.ovSessionId) return String(state.ovSessionId);
    }
    return '';
  }

  function dshIdFor(ovId) {
    const states = memory?.states;
    if (states && typeof states.forEach === 'function') {
      for (const [id, state] of states) {
        if (state?.ovSessionId === ovId) return id;
      }
    }
    return ovId;
  }

  function record(kind, ovId, response, error, ms) {
    const ok = response?.ok === true;
    const status = Number(response?.status) || 0;
    const dshId = dshIdFor(String(ovId || ''));
    if (!dshId) return;
    ledger.bindOv(dshId, String(ovId || ''));
    const detail = error
      ? (error instanceof Error ? error.message : String(error))
      : (ok ? null : `HTTP ${status}`);
    hub.stats.add(String(ovId || ''), kind, ok, Date.now());
    ledger.write(dshId, { kind, ok, status, ms, at: Date.now(), error: detail });
    if (!ok) hub.refreshPending().catch(() => {});
    hub.bump(dshId);
  }

  /**
   * Classify one request the target plugin makes: only the two write endpoints
   * count, and both live writes and pending-queue replays go through
   * `fetchJSON`, so replaying a backlog raises the success counters too.
   */
  function classifyWrite(path, init) {
    if (typeof path !== 'string') return null;
    const method = String(init?.method || 'GET').toUpperCase();
    if (method !== 'POST') return null;
    const match = /^\/api\/v1\/sessions\/([^/]+)\/(messages|commit)\/?$/.exec(path);
    if (!match) return null;
    let ovId = match[1];
    try {
      ovId = decodeURIComponent(ovId);
    } catch {
      // Keep the raw segment when it is not valid percent-encoding.
    }
    return { kind: match[2] === 'commit' ? 'commit' : 'message', ovId };
  }

  function wrap(client) {
    const original = client?.fetchJSON;
    if (typeof original !== 'function') return null;
    const wrapped = function observedWrite(path, init, options) {
      const write = classifyWrite(path, init);
      if (!write) return original.apply(this, arguments);
      const startedAt = Date.now();
      let result;
      try {
        result = original.apply(this, arguments);
      } catch (error) {
        record(write.kind, write.ovId, null, error, Date.now() - startedAt);
        throw error;
      }
      if (!result || typeof result.then !== 'function') {
        record(write.kind, write.ovId, result, null, Date.now() - startedAt);
        return result;
      }
      return result.then(
        (value) => {
          record(write.kind, write.ovId, value, null, Date.now() - startedAt);
          return value;
        },
        (error) => {
          record(write.kind, write.ovId, null, error, Date.now() - startedAt);
          throw error;
        },
      );
    };
    client.fetchJSON = wrapped;
    return () => {
      if (client.fetchJSON === wrapped) client.fetchJSON = original;
    };
  }

  const restores = [];
  const client = memory?.client;
  if (client && typeof client === 'object') {
    const restore = wrap(client);
    if (restore) restores.push(restore);
  }
  scoped.effect(
    () => () => {
      for (const restore of restores) {
        try {
          restore();
        } catch {
          // A frozen or replaced client is not ours to restore.
        }
      }
    },
    'openviking-ui: client observer',
  );

  function skipReason(session) {
    const config = memory?.config;
    if (!config || typeof config !== 'object') return '';
    if (config.enabled === false) return 'capture-off';
    if (config.autoCapture === false) return 'capture-off';
    if (config.skipSubagentSessions && session?.header?.origin === 'subagent') return 'subagent';
    return '';
  }

  async function settle(dshId, turn, state) {
    const writes = state?.writes;
    if (writes && typeof writes.then === 'function') {
      await Promise.race([Promise.resolve(writes).catch(() => {}), sleep(SETTLE_MS)]);
    } else {
      await sleep(SETTLE_FALLBACK_MS);
    }
    await hub.refreshPending().catch(() => {});
    ledger.turnEnd(dshId, turn, Date.now());
    hub.bump(dshId);
  }

  scoped.on('session/event', (session, event) => {
    const dshId = sessionIdOf(session);
    if (!dshId) return;
    const type = event?.type;
    if (type !== 'turn/start' && type !== 'turn/end') return;
    const turn = turnNumberOf(event);
    const ovId = ovIdFor(dshId);
    if (ovId) ledger.bindOv(dshId, ovId);

    if (type === 'turn/start') {
      ledger.turnStart(dshId, turn, Date.now());
      hub.bump(dshId);
      return;
    }

    const reason = skipReason(session);
    if (reason) {
      ledger.skip(dshId, turn, reason, Date.now());
      hub.bump(dshId);
      return;
    }
    const states = memory?.states;
    const state = states && typeof states.get === 'function' ? states.get(dshId) : undefined;
    settle(dshId, turn, state).catch(() => {});
  });

  // Prime the queue view once so the first panel paint is not empty.
  hub.refreshPending().catch(() => {});
}
