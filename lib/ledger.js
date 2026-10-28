/**
 * Write-status ledger: the data behind "did this turn reach OpenViking?".
 *
 * It is pure bookkeeping. The observer feeds it write outcomes and turn
 * boundaries; the views it produces are plain JSON so they can cross the SSE
 * route and a tool result unchanged. Nothing here talks to the network or the
 * filesystem.
 *
 * Status vocabulary (stable, the UI maps it to text):
 *   pending   - the turn is still running / writes not settled yet
 *   written   - messages were accepted, no commit yet
 *   committed - a commit was accepted in this turn
 *   queued    - the local pending queue holds this session's writes
 *   failed    - a write failed and was not queued
 *   skipped   - capture is off, or the session is an isolated subagent
 *   idle      - settled with nothing to write
 */

const MAX_TURNS = 20;
const MAX_SESSIONS = 30;

/** Statuses this ledger can report. */
export const STATUSES = ['pending', 'written', 'committed', 'queued', 'failed', 'skipped', 'idle'];

function emptySession(id, at) {
  return {
    id,
    ovId: '',
    turns: [],
    lastAt: at,
    current: null,
  };
}

/** Status of one turn record, given this session's queued count. */
function statusOf(turn, queued) {
  if (turn.reason === 'capture-off' || turn.reason === 'subagent') return 'skipped';
  if (turn.failures > 0) return queued > 0 ? 'queued' : 'failed';
  if (turn.messages > 0) return turn.commits > 0 ? 'committed' : 'written';
  if (queued > 0) return 'queued';
  return turn.settled ? 'idle' : 'pending';
}

function viewTurn(turn, queued) {
  return {
    turn: turn.turn,
    at: turn.at,
    settledAt: turn.settledAt || 0,
    messages: turn.messages,
    commits: turn.commits,
    failures: turn.failures,
    status: statusOf(turn, queued),
    settled: Boolean(turn.settled),
    reason: turn.reason || '',
    error: turn.error || null,
  };
}

/**
 * Create one ledger.
 * @returns the ledger API used by the observer, routes and tool.
 */
export function createLedger() {
  /** @type {Map<string, object>} */
  const sessions = new Map();
  /** @type {Record<string, number>} */
  let queuedByOv = {};
  let queuedOldest = 0;

  function trimSessions() {
    if (sessions.size <= MAX_SESSIONS) return;
    const ordered = [...sessions.values()].sort((a, b) => a.lastAt - b.lastAt);
    for (const stale of ordered.slice(0, sessions.size - MAX_SESSIONS)) sessions.delete(stale.id);
  }

  function ensure(id, at = Date.now()) {
    let rec = sessions.get(id);
    if (!rec) {
      rec = emptySession(id, at);
      sessions.set(id, rec);
      trimSessions();
    }
    return rec;
  }

  function archive(rec) {
    const current = rec.current;
    rec.current = null;
    if (!current) return;
    rec.turns.push(current);
    if (rec.turns.length > MAX_TURNS) rec.turns.splice(0, rec.turns.length - MAX_TURNS);
  }

  function turnFor(rec, turn, at) {
    if (rec.current && rec.current.turn !== turn) archive(rec);
    if (!rec.current) {
      rec.current = {
        turn,
        at,
        messages: 0,
        commits: 0,
        failures: 0,
        settled: false,
        settledAt: 0,
        reason: '',
        error: null,
      };
    }
    return rec.current;
  }

  const ledger = {
    get size() {
      return sessions.size;
    },

    /** Record the OV session id the target plugin derived for this session. */
    bindOv(id, ovId) {
      if (!ovId) return;
      const rec = ensure(id);
      if (rec.ovId === ovId) return;
      rec.ovId = ovId;
    },

    /** Start (or restart) the record for one turn. */
    turnStart(id, turn, at = Date.now()) {
      const rec = ensure(id, at);
      rec.lastAt = at;
      // A reload can land mid-turn: writes arrived before any `turn/start` was
      // seen, so their provisional record carries turn 0. Adopt the previous
      // turn number rather than archiving the only record with data in it.
      if (rec.current && rec.current.turn === 0 && turn > 0 && !rec.current.settled
        && (rec.current.messages > 0 || rec.current.commits > 0 || rec.current.failures > 0)) {
        rec.current.turn = Math.max(1, turn - 1);
      }
      turnFor(rec, turn, at);
    },

    /** A turn boundary arrived; the record stays open for late writes. */
    turnEnd(id, turn, at = Date.now()) {
      const rec = ensure(id, at);
      rec.lastAt = at;
      // Same adoption on the closing edge: the writes this turn made are in
      // the turn-0 record, so name it with the turn that just ended.
      if (rec.current && rec.current.turn === 0 && turn > 0) rec.current.turn = turn;
      const t = turnFor(rec, turn, at);
      t.settled = true;
      t.settledAt = at;
    },

    /** Mark the turn as deliberately not written. */
    skip(id, turn, reason, at = Date.now()) {
      const rec = ensure(id, at);
      const t = turnFor(rec, turn, at);
      t.reason = reason;
      t.settled = true;
      t.settledAt = at;
    },

    /** One HTTP write outcome from the target plugin. */
    write(id, { kind, ok, status, ms, at = Date.now(), error = null }) {
      const rec = ensure(id, at);
      rec.lastAt = at;
      const t = turnFor(rec, rec.current ? rec.current.turn : 0, at);
      if (ok) {
        if (kind === 'commit') t.commits += 1;
        else t.messages += 1;
      } else {
        t.failures += 1;
        t.error = error || `HTTP ${status || 0}`;
      }
      if (ms !== undefined) t.lastMs = ms;
      return { id, turn: t.turn };
    },

    /** Replace the per-OV-session queued counts (from the pending directory). */
    setPending(bySession, oldestAt = 0) {
      queuedByOv = bySession || {};
      queuedOldest = oldestAt || 0;
    },

    queued(id) {
      const rec = sessions.get(id);
      if (!rec || !rec.ovId) return 0;
      return queuedByOv[rec.ovId] || 0;
    },

    get(id) {
      return sessions.get(id);
    },

    /** Every OpenViking session id this Host has seen, for queue attribution. */
    ovIds() {
      const ids = [];
      for (const rec of sessions.values()) if (rec.ovId) ids.push(rec.ovId);
      return ids;
    },

    /** One session view, or undefined for an unknown id. */
    view(id) {
      const rec = sessions.get(id);
      if (!rec) return undefined;
      const queued = rec.ovId ? queuedByOv[rec.ovId] || 0 : 0;
      return {
        id: rec.id,
        ovId: rec.ovId,
        lastAt: rec.lastAt,
        queued,
        queuedOldestAt: queued > 0 ? queuedOldest : 0,
        lastTurn: rec.current ? viewTurn(rec.current, queued) : null,
        turns: rec.turns.slice(-10).map((t) => viewTurn(t, queued)),
      };
    },

    /** Every known session, newest first. */
    views() {
      return [...sessions.values()]
        .sort((a, b) => b.lastAt - a.lastAt)
        .map((rec) => ledger.view(rec.id))
        .filter(Boolean);
    },
  };

  return ledger;
}
