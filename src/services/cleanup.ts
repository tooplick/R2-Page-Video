import { getAllR2Keys } from './d1';
import type { Env } from '../types';

const PREFIXES = ['videos/', 'thumbnails/'];
const LIST_LIMIT = 1000;
const DEFAULT_GRACE_MS = 60 * 60 * 1000;
const MAX_RETURNED_KEYS = 100;

export interface CleanupResult {
  scanned: number;
  deleted: number;
  deletedKeys: string[];
}

export async function cleanupOrphans(
  env: Env,
  graceMs: number = DEFAULT_GRACE_MS
): Promise<CleanupResult> {
  const knownKeys = await getAllR2Keys(env.DB);
  const cutoff = Date.now() - graceMs;

  let scanned = 0;
  let deleted = 0;
  const deletedKeys: string[] = [];

  for (const prefix of PREFIXES) {
    let cursor: string | undefined;
    do {
      const page = await env.R2_BUCKET.list({ prefix, cursor, limit: LIST_LIMIT });
      scanned += page.objects.length;

      for (const obj of page.objects) {
        if (knownKeys.has(obj.key)) continue;
        if (obj.uploaded.getTime() > cutoff) continue;

        await env.R2_BUCKET.delete(obj.key);
        deleted++;
        if (deletedKeys.length < MAX_RETURNED_KEYS) {
          deletedKeys.push(obj.key);
        }
      }

      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }

  console.log(`[cleanup] scanned=${scanned} deleted=${deleted}`);
  return { scanned, deleted, deletedKeys };
}
