/**
 * Model-facing access to the same operations the panel exposes.
 *
 * The definition is registered in the registry's native shape (JSON-Schema
 * parameters + an output contract) rather than through the `defineTool` helper:
 * a plain-JS bundle has no dependency on `@deepseek-ai/dsh-tools`, and the
 * registry only requires `output.render` plus a supported schema.
 *
 * A registration failure is reported to the panel's own diagnostics rather than
 * thrown: losing the tool must not take the UI down with it.
 */

import { appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIAGNOSTIC_FILE = join(tmpdir(), 'dsh-openviking-ui.log');

function noteDiagnostic(message) {
  try {
    appendFileSync(DIAGNOSTIC_FILE, `${new Date().toISOString()} ${message}\n`, 'utf8');
  } catch {
    // Diagnostics are best effort.
  }
}

const ACTIONS = ['status', 'writes', 'stats', 'reset_stats', 'save', 'test', 'reset'];

/** Build the tool definition shared by every registration attempt. */
export function toolDefinition(hub) {
  return {
    name: 'openviking_ui',
    description:
      'Read or change how this profile connects to OpenViking memory, and inspect whether recent turns were written. '
      + '`status` returns the saved and effective connection plus recent write history; `writes` returns per-session turn records; '
      + '`stats` returns the shared write counters (queued, written messages, commits, failures); `reset_stats` zeroes them; '
      + '`save` persists endpoint/apiKey/account/user/authMode into the OpenViking memory row and hot-reloads it; '
      + '`test` probes GET {endpoint}/health without saving; `reset` removes this profile\'s overrides so env/ovcli.conf apply again.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ACTIONS,
          description: 'What to do.',
        },
        endpoint: { type: 'string', description: 'Server base URL (http/https), for save/test.' },
        apiKey: { type: 'string', description: 'Bearer credential for save/test. Omit to keep the saved one.' },
        account: { type: 'string', description: 'Trusted-mode account, for save/test.' },
        user: { type: 'string', description: 'Trusted-mode user, for save/test.' },
        authMode: {
          type: 'string',
          enum: ['api_key', 'trusted'],
          description: 'api_key sends a bearer token; trusted sends account/user headers.',
        },
        clearApiKey: { type: 'boolean', description: 'With save: delete the stored key instead of keeping it.' },
        sessionId: { type: 'string', description: 'With writes: restrict the answer to one session id.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {},
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args) {
      const action = args?.action;
      if (!ACTIONS.includes(action)) return { ok: false, error: 'unknown_action' };
      if (action === 'status' || action === 'writes' || action === 'stats') {
        await hub.refreshPending().catch(() => {});
      }
      if (action === 'status') return hub.snapshot();
      if (action === 'writes') {
        const snapshot = hub.snapshot();
        const sessions = args?.sessionId
          ? snapshot.sessions.filter((session) => session.id === args.sessionId)
          : snapshot.sessions;
        return { pending: snapshot.pending, sessions };
      }
      if (action === 'stats') return { stats: hub.statsView(), pending: hub.pendingView() };
      if (action === 'reset_stats') return { ok: true, stats: await hub.resetStats() };
      if (action === 'save') return hub.config.save(args || {});
      if (action === 'test') return hub.config.test(args || {});
      return hub.config.reset();
    },
  };
}

/**
 * Register the tool on a context that carries `tools`.
 * @param scoped - context with the tool registry.
 * @param hub - state hub.
 */
export function registerTool(scoped, hub) {
  let dispose;
  try {
    dispose = scoped.tools.register(toolDefinition(hub));
  } catch (error) {
    noteDiagnostic(`tool registration failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  noteDiagnostic('tool registered: openviking_ui');
  scoped.effect(
    () => () => {
      try {
        dispose();
      } catch {
        // The registry already unloaded.
      }
    },
    'openviking-ui: tool',
  );
}
