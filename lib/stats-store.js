/**
 * Cross-profile write statistics.
 *
 * Counts live in `~/.openviking/dsh-openviking-ui-stats.json`, next to the
 * pending queue the target plugin already shares between every harness and
 * profile on this machine. A second writer is therefore normal: every flush
 * re-reads the file, adds only this process's unflushed delta, and writes it
 * back, so two running Hosts merge instead of clobbering each other.
 *
 * Only counts and timestamps are stored -- never message content or credentials.
 */

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VERSION = 1;
const FLUSH_MS = 2000;
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const LOCK_TTL_MS = 5000;

export function statsPath() {
  const override = typeof process.env.OPENVIKING_STATS_FILE === 'string' ? process.env.OPENVIKING_STATS_FILE.trim() : '';
  return override || join(homedir(), '.openviking', 'dsh-openviking-ui-stats.json');
}

function zero() {
  return { messages: 0, commits: 0, failures: 0, lastOkAt: 0 };
}

function sanitizeCount(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return { ...zero(), lastOkAt: 0 };
  return {
    messages: sanitizeCount(raw.messages),
    commits: sanitizeCount(raw.commits),
    failures: sanitizeCount(raw.failures),
    lastOkAt: sanitizeCount(raw.lastOkAt),
  };
}

function sanitizeDocument(raw) {
  const now = Date.now();
  const source = raw && typeof raw === 'object' ? raw : {};
  const sessions = {};
  const inputSessions = source.sessions && typeof source.sessions === 'object' ? source.sessions : {};
  for (const [key, value] of Object.entries(inputSessions)) {
    if (typeof key !== 'string' || key.length === 0 || key.length > 200) continue;
    sessions[key] = sanitizeEntry(value);
  }
  const totals = sanitizeEntry(source.totals);
  // Older documents recorded the last success per session only; keep the
  // headline "recent success" honest without a rewrite.
  if (!totals.lastOkAt) {
    for (const entry of Object.values(sessions)) {
      if (entry.lastOkAt > totals.lastOkAt) totals.lastOkAt = entry.lastOkAt;
    }
  }
  return {
    version: VERSION,
    since: sanitizeCount(source.since) || now,
    updatedAt: sanitizeCount(source.updatedAt) || 0,
    totals,
    sessions,
  };
}

function addInto(target, delta) {
  target.messages += delta.messages;
  target.commits += delta.commits;
  target.failures += delta.failures;
  if (delta.lastOkAt && delta.lastOkAt > target.lastOkAt) target.lastOkAt = delta.lastOkAt;
  return target;
}

function merge(base, delta) {
  const out = {
    version: VERSION,
    since: base.since,
    updatedAt: Math.max(base.updatedAt, delta.updatedAt),
    totals: addInto({ ...base.totals }, delta.totals),
    sessions: {},
  };
  for (const [key, value] of Object.entries(base.sessions)) out.sessions[key] = { ...value };
  for (const [key, value] of Object.entries(delta.sessions)) {
    out.sessions[key] = addInto(out.sessions[key] ? { ...out.sessions[key] } : { ...zero(), lastOkAt: 0 }, value);
  }
  return out;
}

async function readDocument(file) {
  try {
    const text = await readFile(file, 'utf8');
    return sanitizeDocument(JSON.parse(text));
  } catch {
    return sanitizeDocument(null);
  }
}

async function withLock(file, run) {
  const lock = `${file}.lock`;
  let held = false;
  for (let attempt = 0; attempt < 3 && !held; attempt += 1) {
    try {
      await writeFile(lock, String(process.pid), { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      held = true;
    } catch {
      try {
        const pid = Number(await readFile(lock, 'utf8'));
        const alive = Number.isInteger(pid) && pid > 0 && pid !== process.pid && (() => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        })();
        if (!alive) await unlink(lock).catch(() => {});
      } catch {
        // A lock we cannot read is treated as stale.
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }
  try {
    return await run();
  } finally {
    if (held) await unlink(lock).catch(() => {});
  }
}

export function createStatsStore() {
  let base = sanitizeDocument(null);
  let loaded = false;
  let delta = { totals: zero(), sessions: {}, updatedAt: 0 };
  let run = { messages: 0, commits: 0, failures: 0 };
  let timer = null;
  let flushing = null;

  const file = statsPath();

  function markDirty() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      flush().catch(() => {});
    }, FLUSH_MS);
    if (typeof timer.unref === 'function') timer.unref();
  }

  async function flush() {
    if (flushing) return flushing;
    const snapshot = delta;
    const at = Date.now();
    if (snapshot.totals.messages + snapshot.totals.commits + snapshot.totals.failures === 0
      && Object.keys(snapshot.sessions).length === 0) {
      return undefined;
    }
    delta = { totals: zero(), sessions: {}, updatedAt: 0 };
    flushing = (async () => {
      await mkdir(join(homedir(), '.openviking'), { recursive: true }).catch(() => {});
      await withLock(file, async () => {
        const stored = await readDocument(file);
        const merged = merge(stored, { ...snapshot, updatedAt: at });
        merged.updatedAt = at;
        // Drop sessions that have been quiet for a month so the file stays small.
        for (const [key, value] of Object.entries(merged.sessions)) {
          if (!value.lastOkAt && !value.messages && !value.commits && !value.failures) delete merged.sessions[key];
          else if (value.lastOkAt && at - value.lastOkAt > SESSION_TTL_MS) delete merged.sessions[key];
        }
        const tmp = `${file}.tmp.${process.pid}`;
        await writeFile(tmp, JSON.stringify(merged, null, 2), { encoding: 'utf8', mode: 0o600 });
        await rename(tmp, file);
        base = merged;
      });
      flushing = null;
    })();
    return flushing;
  }

  const store = {
    get loaded() {
      return loaded;
    },
    /** Merge this process's counters with the shared file. */
    async load() {
      base = await readDocument(file);
      loaded = true;
      return store.view();
    },
    /** Record one observed HTTP write outcome. */
    add(ovId, kind, ok, at = Date.now()) {
      const field = kind === 'commit' ? 'commits' : 'messages';
      const bucket = ok ? field : 'failures';
      run[bucket] += 1;
      delta.totals[bucket] += 1;
      delta.updatedAt = at;
      if (ok) delta.totals.lastOkAt = at;
      const key = typeof ovId === 'string' && ovId.length > 0 && ovId.length <= 200 ? ovId : '';
      if (key) {
        const entry = delta.sessions[key] || (delta.sessions[key] = { ...zero(), lastOkAt: 0 });
        entry[bucket] += 1;
        if (ok) entry.lastOkAt = at;
      }
      markDirty();
    },
    /** Counters as the UI should read them: stored totals plus unflushed deltas. */
    view() {
      const merged = merge(base, delta);
      return {
        since: merged.since,
        updatedAt: merged.updatedAt,
        totals: merged.totals,
        sessions: merged.sessions,
        run: { ...run },
      };
    },
    session(ovId) {
      if (!ovId) return { ...zero(), lastOkAt: 0 };
      const entry = merge(base, delta).sessions[ovId];
      return entry ? { ...entry } : { ...zero(), lastOkAt: 0 };
    },
    async reset() {
      delta = { totals: zero(), sessions: {}, updatedAt: 0 };
      run = { messages: 0, commits: 0, failures: 0 };
      const fresh = sanitizeDocument({ since: Date.now(), totals: zero(), sessions: {} });
      await mkdir(join(homedir(), '.openviking'), { recursive: true }).catch(() => {});
      await withLock(file, async () => {
        const tmp = `${file}.tmp.${process.pid}`;
        await writeFile(tmp, JSON.stringify(fresh, null, 2), { encoding: 'utf8', mode: 0o600 });
        await rename(tmp, file);
        base = fresh;
      });
      return store.view();
    },
    async dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      await flush().catch(() => {});
    },
    /** Unused today; kept so a stale lock cannot outlive a crashed writer. */
    lockTtlMs: LOCK_TTL_MS,
  };

  return store;
}
