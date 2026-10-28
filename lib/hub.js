/**
 * The plugin's live state hub: write ledger, shared statistics, pending queue,
 * and the fan-out to whoever is watching (SSE, HTTP reads, the agent tool).
 */

import { createConfigService } from './config-service.js';
import { createLedger } from './ledger.js';
import { scanPending } from './pending.js';
import { createStatsStore } from './stats-store.js';

const SCAN_MS = 5000;

/**
 * Build the hub for one Host context.
 * @param ctx - the plugin context; soft services are resolved live.
 */
export function createHub(ctx) {
  const ledger = createLedger();
  const stats = createStatsStore();
  const config = createConfigService(ctx);
  const subscribers = new Set();
  const bootAt = Date.now();
  let rev = 0;
  let pending = { dir: '', total: 0, oldestAt: 0, updatedAt: 0, entries: [] };
  let scanTimer = null;
  let clientRequests = 0;

  stats.load().then(() => bump(undefined)).catch(() => {});

  function bump(sessionId) {
    rev += 1;
    const frame = {
      rev,
      sessionId: sessionId || undefined,
      view: sessionId ? sessionView(sessionId) : undefined,
    };
    for (const listener of subscribers) {
      try {
        listener(frame);
      } catch {
        // One broken stream must not stop the others.
      }
    }
  }

  /** Queue totals split by attribution to this Host and by this run's window. */
  function pendingView() {
    const known = new Set(ledger.ovIds());
    let attributable = 0;
    let historical = 0;
    let current = 0;
    let oldestAttributable = 0;
    for (const entry of pending.entries) {
      const mine = known.has(entry.sessionId);
      if (mine) {
        attributable += 1;
        if (entry.createdAt && (!oldestAttributable || entry.createdAt < oldestAttributable)) {
          oldestAttributable = entry.createdAt;
        }
      }
      if (entry.createdAt && entry.createdAt < bootAt) historical += 1;
      else current += 1;
    }
    return {
      dir: pending.dir,
      total: pending.total,
      attributable,
      other: pending.total - attributable,
      historical,
      current,
      oldestAt: pending.oldestAt,
      oldestAttributableAt: oldestAttributable,
      updatedAt: pending.updatedAt,
    };
  }

  function sessionPeer(id) {
    try {
      const memory = ctx.get('openvikingMemory');
      const state = memory && typeof memory.states?.get === 'function' ? memory.states.get(id) : undefined;
      return String(state?.config?.peerId || '');
    } catch {
      return '';
    }
  }

  function sessionView(id) {
    const view = ledger.view(id);
    if (!view) return undefined;
    return { ...view, stats: stats.session(view.ovId), peerId: sessionPeer(id) };
  }

  function views() {
    return ledger.views().map((view) => ({ ...view, stats: stats.session(view.ovId), peerId: sessionPeer(view.id) }));
  }

  async function refreshPending() {
    const next = await scanPending();
    const changed = next.total !== pending.total
      || next.oldestAt !== pending.oldestAt
      || next.entries.length !== pending.entries.length;
    pending = next;
    if (changed) bump(undefined);
    return next;
  }

  function statsView() {
    return stats.view();
  }

  function snapshot() {
    return {
      rev,
      config: config.status(),
      pending: pendingView(),
      stats: statsView(),
      sessions: views(),
      live: subscribers.size,
      clientRequests,
      bootAt,
    };
  }

  function subscribe(listener) {
    subscribers.add(listener);
    if (!scanTimer) {
      scanTimer = setInterval(() => {
        refreshPending().catch(() => {});
      }, SCAN_MS);
      if (typeof scanTimer.unref === 'function') scanTimer.unref();
    }
    return () => {
      subscribers.delete(listener);
      if (subscribers.size === 0 && scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
      }
    };
  }

  ctx.effect(
    () => () => {
      if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
      }
      stats.dispose().catch(() => {});
    },
    'openviking-ui: pending scan and stats flush',
  );

  return {
    ledger,
    stats,
    config,
    bump,
    snapshot,
    refreshPending,
    subscribe,
    statsView,
    pendingView,
    sessionView,
    status: () => config.status(),
    view: (id) => sessionView(id),
    views,
    resetStats: () => stats.reset(),
    get rev() {
      return rev;
    },
    get pending() {
      return pendingView();
    },
    noteClientRequest() {
      clientRequests += 1;
    },
  };
}
