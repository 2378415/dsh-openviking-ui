/**
 * Cloud-service configuration for the OpenViking memory plugin.
 *
 * The target plugin resolves its connection as host config > env >
 * `~/.openviking/ovcli.conf` > `~/.openviking/ov.conf`, where the host config
 * is the `config` block of its Cordis row. That row's id is fixed by the
 * bundle patch (`openviking-memory-runtime`), so writing it through
 * `ctx.configEditor` both wins the precedence chain and hot-reloads exactly
 * that one row — no restart, no second configuration file to keep in step.
 *
 * The target plugin exports no Config schema, so nothing validates this block
 * on its behalf: validation and value cleanup live here.
 */

const ROW_ID = 'openviking-memory-runtime';
const AUTH_MODES = ['api_key', 'trusted'];
const CONNECTION_KEYS = ['endpoint', 'apiKey', 'account', 'user', 'authMode'];
const PEER_KEYS = ['peerId', 'peerSource', 'workspacePeer', 'recallPeerScope'];
const PEER_SOURCE_PRESETS = ['git', 'cwd', 'none'];
const PEER_ID_RE = /^[A-Za-z0-9._-]{1,120}$/;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/** Mask a credential for display; the secret itself never leaves the Host. */
export function maskKey(key) {
  const value = text(key);
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}

function trimUrl(value) {
  return text(value).replace(/\/+$/, '');
}

function parseEndpoint(value) {
  const url = trimUrl(value);
  if (!url) return { value: '', error: '' };
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { value: url, error: 'invalid_url' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { value: url, error: 'invalid_scheme' };
  return { value: url, error: '' };
}

/**
 * Build the configuration operations over one Host context.
 * @param ctx - the plugin context (soft services are looked up live).
 */
export function createConfigService(ctx) {
  const memory = () => {
    const service = ctx.get('openvikingMemory');
    return service && typeof service === 'object' ? service : undefined;
  };
  const editor = () => {
    const service = ctx.get('configEditor');
    return service && typeof service === 'object' ? service : undefined;
  };

  function findEntry(service) {
    try {
      const entries = service.entries();
      return (Array.isArray(entries) ? entries : []).find((entry) => entry?.options?.id === ROW_ID) || null;
    } catch {
      return null;
    }
  }

  function savedConfig(service, entry) {
    try {
      const rows = service.configuration();
      const row = (Array.isArray(rows) ? rows : []).find((candidate) => candidate?.entry === entry);
      return { ...(row?.override && typeof row.override === 'object' ? row.override : {}) };
    } catch {
      return {};
    }
  }

  function effective() {
    const config = memory()?.config;
    if (!config || typeof config !== 'object') return null;
    return {
      endpoint: text(config.baseUrl),
      mcpUrl: text(config.mcpUrl),
      authMode: text(config.authMode),
      account: text(config.account),
      user: text(config.user),
      hasApiKey: Boolean(text(config.apiKey)),
      keyHint: maskKey(config.apiKey),
      credentialSource: text(config.credentialSource),
      apiKeySource: text(config.apiKeySource),
      credentialPath: text(config.credentialPath),
      recallPeerScope: text(config.recallPeerScope),
      workspacePeer: config.workspacePeer !== false,
    };
  }

  /** The peer the running memory plugin actually resolves, and where it came from. */
  function peerState() {
    const config = memory()?.config;
    const effectivePeer = config?.effectivePeer && typeof config.effectivePeer === 'object'
      ? config.effectivePeer
      : {};
    return {
      peerId: text(config?.peerId),
      source: text(effectivePeer.source),
      origin: text(effectivePeer.origin),
      legacyPeerId: text(effectivePeer.legacyPeerId),
      recallPeerScope: text(config?.recallPeerScope),
      workspacePeer: config?.workspacePeer !== false,
    };
  }

  function status() {
    const service = editor();
    const entry = service ? findEntry(service) : null;
    const saved = entry ? savedConfig(service, entry) : {};
    return {
      rowId: ROW_ID,
      installed: Boolean(entry),
      memoryActive: Boolean(memory()),
      canWrite: Boolean(service && entry),
      saved: {
        endpoint: text(saved.endpoint),
        account: text(saved.account),
        user: text(saved.user),
        authMode: text(saved.authMode),
        hasApiKey: Boolean(text(saved.apiKey)),
        keyHint: maskKey(saved.apiKey),
        peerId: text(saved.peerId),
        peerSource: text(saved.peerSource),
        workspacePeer: typeof saved.workspacePeer === 'boolean' ? saved.workspacePeer : null,
        recallPeerScope: text(saved.recallPeerScope),
      },
      effective: effective(),
      peer: peerState(),
    };
  }

  /**
   * Merge the requested fields with the saved block and persist it.
   * @param input - `{ endpoint?, apiKey?, account?, user?, authMode?, clearApiKey? }`
   * @returns `{ ok, applied, errors, status, note }`
   */
  async function save(input = {}) {
    const service = editor();
    const entry = service ? findEntry(service) : null;
    if (!service || !entry) {
      return { ok: false, applied: false, error: 'not_installed', status: status() };
    }
    const current = savedConfig(service, entry);
    const effectiveNow = effective() || {};
    const next = { ...current };
    const errors = {};

    if (input.endpoint !== undefined) {
      const parsed = parseEndpoint(input.endpoint);
      if (parsed.error) errors.endpoint = parsed.error;
      else if (!parsed.value) delete next.endpoint;
      else next.endpoint = parsed.value;
    }
    if (input.authMode !== undefined) {
      const mode = text(input.authMode);
      if (mode === '') delete next.authMode;
      else if (!AUTH_MODES.includes(mode)) errors.authMode = 'invalid_mode';
      else next.authMode = mode;
    }
    if (input.account !== undefined) {
      const value = text(input.account);
      if (value) next.account = value;
      else delete next.account;
    }
    if (input.user !== undefined) {
      const value = text(input.user);
      if (value) next.user = value;
      else delete next.user;
    }
    if (input.clearApiKey === true) {
      delete next.apiKey;
    } else if (input.apiKey !== undefined && text(input.apiKey) !== '') {
      next.apiKey = text(input.apiKey);
    }
    if (input.peerId !== undefined) {
      const value = text(input.peerId);
      if (!value) delete next.peerId;
      else if (!PEER_ID_RE.test(value)) errors.peerId = 'invalid_peer_id';
      else next.peerId = value;
    }
    if (input.peerSource !== undefined) {
      const raw = text(input.peerSource);
      if (!raw) {
        delete next.peerSource;
      } else {
        const list = raw.split(',').map((item) => item.trim()).filter(Boolean);
        const invalid = list.some((item) => !PEER_SOURCE_PRESETS.includes(item) && !item.includes('{'));
        if (invalid || list.length === 0) errors.peerSource = 'invalid_peer_source';
        else next.peerSource = list.length > 1 ? list : list[0];
      }
    }
    if (input.workspacePeer !== undefined) {
      if (input.workspacePeer === null) delete next.workspacePeer;
      else next.workspacePeer = input.workspacePeer === true || input.workspacePeer === 'true';
    }
    if (input.recallPeerScope !== undefined) {
      const mode = text(input.recallPeerScope);
      if (!mode) delete next.recallPeerScope;
      else if (mode !== 'all' && mode !== 'actor') errors.recallPeerScope = 'invalid_scope';
      else next.recallPeerScope = mode;
    }

    // The target plugin treats a trusted identity as "account or user present";
    // require the same shape here so a saved block cannot mean something else.
    const mode = text(next.authMode) || text(effectiveNow.authMode);
    const account = text(next.account) || text(effectiveNow.account);
    const user = text(next.user) || text(effectiveNow.user);
    if (mode === 'trusted' && !account && !user) errors.authMode = 'trusted_requires_identity';

    if (Object.keys(errors).length > 0) {
      return { ok: false, applied: false, errors, status: status() };
    }

    try {
      await service.edit(entry, (raw) => {
        const merged = { ...(raw && typeof raw === 'object' ? raw : {}) };
        for (const key of [...CONNECTION_KEYS, ...PEER_KEYS]) delete merged[key];
        for (const [key, value] of Object.entries(next)) merged[key] = value;
        return merged;
      });
    } catch (error) {
      return {
        ok: false,
        applied: false,
        error: 'write_failed',
        message: error instanceof Error ? error.message : String(error),
        status: status(),
      };
    }

    // `edit()` reconciles the row before it resolves; give the replacement row
    // one turn of the event loop so `openvikingMemory` is the new instance.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const after = status();
    const applied = input.endpoint === undefined
      ? true
      : trimUrl(after.effective?.endpoint) === trimUrl(next.endpoint);
    return {
      ok: true,
      applied,
      status: after,
      note: applied ? '' : 'saved_but_not_effective',
    };
  }

  /** Drop this plugin's keys from the row config so every layer below applies. */
  async function reset() {
    const service = editor();
    const entry = service ? findEntry(service) : null;
    if (!service || !entry) return { ok: false, applied: false, error: 'not_installed', status: status() };
    try {
      await service.edit(entry, (raw) => {
        const merged = { ...(raw && typeof raw === 'object' ? raw : {}) };
        for (const key of [...CONNECTION_KEYS, ...PEER_KEYS]) delete merged[key];
        return merged;
      });
    } catch (error) {
      return {
        ok: false,
        applied: false,
        error: 'write_failed',
        message: error instanceof Error ? error.message : String(error),
        status: status(),
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
    return { ok: true, applied: true, status: status() };
  }

  /**
   * Probe `GET {endpoint}/health` with the credential the target plugin would
   * send. The secret stays in the Host: the browser may omit `apiKey`, in which
   * case the live resolved key is used.
   */
  async function test(input = {}) {
    const current = effective() || {};
    const endpoint = trimUrl(input.endpoint !== undefined ? input.endpoint : current.endpoint);
    const parsed = parseEndpoint(endpoint);
    if (parsed.error || !parsed.value) {
      return { ok: false, status: 0, endpoint, error: parsed.error || 'missing_endpoint' };
    }
    const apiKey = text(input.apiKey) || text(memory()?.config?.apiKey);
    const authMode = text(input.authMode) || current.authMode || (apiKey ? 'api_key' : 'trusted');
    const account = input.account !== undefined ? text(input.account) : current.account;
    const user = input.user !== undefined ? text(input.user) : current.user;
    const headers = { 'User-Agent': 'dsh-openviking-ui/1.0.0' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    if (authMode === 'trusted') {
      if (account) headers['X-OpenViking-Account'] = account;
      if (user) headers['X-OpenViking-User'] = user;
    }
    const startedAt = Date.now();
    try {
      const response = await fetch(`${parsed.value}/health`, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      return {
        ok: response.ok,
        status: response.status,
        ms: Date.now() - startedAt,
        endpoint: parsed.value,
        authMode,
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        ms: Date.now() - startedAt,
        endpoint: parsed.value,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { status, save, reset, test, effective, rowId: ROW_ID };
}
