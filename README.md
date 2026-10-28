# dsh-openviking-ui

Cloud-service configuration and live write status for
[`@openviking/dsh-memory-plugin`](https://www.npmjs.com/package/@openviking/dsh-memory-plugin)
in DeepSeek Harness.

Two capabilities in one bundle:

1. **Configuration** — set the OpenViking server and identity the memory plugin
   uses, from a settings page or from the plugin's own page. The values are
   written to this profile's `cordis.patch.yml` through the Host's
   `configEditor`, so they win the memory plugin's own precedence chain
   (host config > env > `~/.openviking/ovcli.conf` > `~/.openviking/ov.conf`)
   and only that one row is hot-reloaded.
2. **Write status** — at the end of every turn, and in the sidebar, show whether
   the turn was written to OpenViking. Statuses: written, written + committed,
   queued for retry, failed, skipped (capture off / isolated subagent), or
   nothing to write.

## Where it appears

| Seat | Surface |
| --- | --- |
| `conversation.chat.turnTail` | One line after a completed turn: `本轮已写入 4 条` / `本轮未写入 · 已入队（本会话排队 3 条）` |
| `sidebar.footer.action` | Persistent full-width card: two rows (`排队 0` / `成功 452 条 · 提交 18 次`) plus the update time, with an expandable detail panel. The settings page has a switch that hides this card only (stored in the browser). |
| `sidebar.session.row.leading` | Session dot (only while the row itself is idle) |
| `sidebar.session.row.hover` | Two lines: this session's written/commits, queue and last success |
| `settings.section` | "OpenViking" settings page: the form plus counters, queue split and per-session rows |
| `plugins.bundle.config` | The same form on the OpenViking memory plugin's page |

## Counters

Two numbers, never mixed:

- **排队** — files in `~/.openviking/pending` (`.json` only). The card shows the
  directory total and, in the panel, splits it into this profile's sessions,
  other programs, backlog from before this Host started, and this run.
- **成功 / 提交** — successful `POST …/messages` and `POST …/commit` calls.
  They live in `~/.openviking/dsh-openviking-ui-stats.json`, shared by every
  profile and harness on the machine (read-modify-write, count-only, mode 0600),
  so they survive plugin reloads and app restarts. `since` records the first
  observation; successes from before that moment cannot be reconstructed.
- **失败** — writes that failed and did not go to the queue (4xx other than the
  retryable set).

Counts are refreshed every 5 seconds while the panel is open, after every turn,
on every write, and immediately when the window becomes visible. The card always
shows the age of the queue figure.

Observing `client.fetchJSON` rather than `addMessage` means pending-queue
replays raise the success counters too — a drained queue no longer looks like
messages that vanished.

## How the status is derived

Nothing is inferred from transcripts and the target package is never modified:

- the live `openvikingMemory.client.addMessage` / `commitSession` calls are
  observed through a transparent wrapper (restored on unload), which yields the
  real HTTP outcome per write;
- turn boundaries come from the `session/event` stream, and each turn record
  stays open for a short settle window so writes that finish just after
  `turn/end` still land on that turn;
- `~/.openviking/pending/*.json` (or `OPENVIKING_PENDING_DIR`) gives the queued
  count per OpenViking session, which is what turns a failure into "queued for
  retry" instead of a bare error.

When the target plugin, its client shape, or the config editor is missing, the
corresponding surface degrades instead of failing: the tool and the panel keep
working, and the status simply reports less.

## Agent tool

`openviking_ui` exposes the same operations: `status`, `writes`, `save`, `test`,
`reset`. It is registered only when `@deepseek-ai/dsh-tools` resolves; without
it the UI is unaffected.

## HTTP surface

All routes live under `/dsh-openviking-ui/api` and run the Host's own trust gate
(`ctx.connection.requestRejection`), falling back to a loopback + same-origin
fence on hosts without that service.

| Route | Purpose |
| --- | --- |
| `GET /status` | snapshot: config, pending queue, per-session write records |
| `GET /stream` | SSE: `snapshot`, `session`, `pending` frames |
| `GET /pending` | pending queue counts per session |
| `POST /config` | save `{ endpoint, apiKey?, account?, user?, authMode?, clearApiKey? }` |
| `POST /config/test` | probe `GET {endpoint}/health` without saving |
| `POST /config/reset` | drop this bundle's overrides from the row config |

The API key never leaves the Host: the UI receives `hasApiKey` plus a masked
hint, and `test` uses the live resolved credential when no key is supplied.

## OpenViking cloud

The cloud preset and the empty-form default are
`https://api.vikingdb.cn-beijing.volces.com/openviking` (its `/health` answers
`401` without a credential, which the panel reports as "reachable, not
authorized" rather than "unreachable"). A profile that has never been
configured — no saved row config, no `~/.openviking/ovcli.conf`, and the live
value still equal to the plugin's `127.0.0.1:1933` fallback — opens with that
address prefilled so picking the cloud is one click plus a key.

## Project identity (peer)

The settings page also owns the memory plugin's peer knobs, all of which are
written to the same row config:

| Field | Key | Default |
| --- | --- | --- |
| Identity source | `peerSource` | inherit (`git`: `{git_remote}` then `{git_root}`) |
| Custom template(s) | `peerSource` | comma-separated fallback chain |
| Fixed project ID | `peerId` | empty (derive from the source) |
| Recall scope | `recallPeerScope` | inherit (`all`) |
| Workspace identity | `workspacePeer` | inherit (on) |

Template variables: `{git_remote}`, `{git_root}`, `{dir}`, `{cwd}`, `{harness}`.
A fixed `peerId` outranks every other layer, including each project's own
`.openviking/config.json`, so it is empty by default. The panel shows the peer
the running plugin resolves (fixed ID / workspace rule / none); a directory
without `.git` resolves to no peer under the default source, which is why such
projects should pick "by directory" or a fixed ID.

## Notes

- The panel's own text is Chinese by default (the Chinese dictionary is
  resolved first), so a browser-derived English locale cannot silently turn
  these labels English. The English dictionary stays registered for a future
  per-plugin switch.
- A save reloads the memory row: in-flight sessions can lose one write, and the
  MCP bridge restarts. Applying between turns is the intended use.
- The credential is stored in the profile's `cordis.patch.yml`, which is written
  with mode 0600 by the config editor.
- Requires a Host with a web server (Desktop or `dsh web`).
