/**
 * Read the OpenViking pending queue.
 *
 * The memory plugin writes failed writes to `~/.openviking/pending/` as one
 * JSON file per operation (`{ type, sessionId, payload, createdAt, retries }`).
 * That directory is shared by every harness and profile of this user, so only
 * metadata is read here and the caller decides what to attribute to this Host.
 * Payloads are never touched.
 */

import { readdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** The directory the target plugin would use, honouring its own override. */
export function pendingDir(env = process.env) {
  const configured = typeof env?.OPENVIKING_PENDING_DIR === 'string' ? env.OPENVIKING_PENDING_DIR.trim() : '';
  return configured || join(homedir(), '.openviking', 'pending');
}

/**
 * List queued operations as `{ sessionId, createdAt }` rows.
 * @returns `{ dir, total, oldestAt, updatedAt, entries }`, never throws.
 */
export async function scanPending(env = process.env) {
  const dir = pendingDir(env);
  const updatedAt = Date.now();
  let files = [];
  try {
    files = await readdir(dir);
  } catch {
    return { dir, total: 0, oldestAt: 0, updatedAt, entries: [] };
  }
  const entries = [];
  let oldestAt = 0;
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    let entry;
    try {
      // A queue file written by an editor (or a repair script) can carry a BOM;
      // parsing it as-is would silently hide a real queued write.
      const text = (await readFile(join(dir, file), 'utf8')).replace(/^\uFEFF/, '');
      entry = JSON.parse(text);
    } catch {
      continue;
    }
    const sessionId = typeof entry?.sessionId === 'string' ? entry.sessionId : '';
    if (!sessionId) continue;
    const createdAt = Number(entry.createdAt) || 0;
    if (createdAt && (!oldestAt || createdAt < oldestAt)) oldestAt = createdAt;
    entries.push({ sessionId, createdAt });
  }
  return { dir, total: entries.length, oldestAt, updatedAt, entries };
}
