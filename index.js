/**
 * dsh-openviking-ui — Host half.
 *
 * Two jobs, one entry:
 *   1. configure the OpenViking memory plugin's cloud service (its Cordis row
 *      config, written through `ctx.configEditor` so it wins the credential
 *      chain and hot-reloads that one row), and
 *   2. report, per turn and per session, whether the turn actually reached
 *      OpenViking -- by observing the target plugin's HTTP client and its
 *      documented pending queue, never by changing it.
 *
 * Every optional capability is injected softly: no OpenViking plugin, no
 * config editor, or no dsh-tools simply removes that surface instead of
 * failing the row.
 */

import { createHub } from './lib/hub.js';
import { installObserver } from './lib/observer.js';
import { registerRoutes } from './lib/routes.js';
import { registerTool } from './lib/tool.js';

export const name = 'openviking-ui';
export const inject = ['webServer'];

export function apply(ctx) {
  const hub = createHub(ctx);

  ctx.effect(() => registerRoutes(ctx, hub), 'openviking-ui: routes');

  ctx.inject(['openvikingMemory'], (scoped) => {
    installObserver(scoped, hub);
  });

  ctx.inject(['tools'], (scoped) => {
    registerTool(scoped, hub);
  });
}
