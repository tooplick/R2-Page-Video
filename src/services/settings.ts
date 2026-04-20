export const DEFAULT_MAX_SINGLE_VIDEO_SIZE = 1073741824;
export const DEFAULT_MAX_TOTAL_STORAGE = 10200547328;

export interface UploadLimits {
  maxSingleVideoSize: number;
  maxTotalStorage: number;
}

async function readKey(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function writeKey(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(key, value)
    .run();
}

export async function getSettings(db: D1Database): Promise<UploadLimits> {
  const [single, total] = await Promise.all([
    readKey(db, 'max_single_video_size'),
    readKey(db, 'max_total_storage'),
  ]);
  return {
    maxSingleVideoSize: single ? Number(single) : DEFAULT_MAX_SINGLE_VIDEO_SIZE,
    maxTotalStorage: total ? Number(total) : DEFAULT_MAX_TOTAL_STORAGE,
  };
}

export async function updateSettings(
  db: D1Database,
  partial: Partial<UploadLimits>
): Promise<void> {
  const ops: Promise<void>[] = [];
  if (typeof partial.maxSingleVideoSize === 'number') {
    ops.push(writeKey(db, 'max_single_video_size', String(Math.floor(partial.maxSingleVideoSize))));
  }
  if (typeof partial.maxTotalStorage === 'number') {
    ops.push(writeKey(db, 'max_total_storage', String(Math.floor(partial.maxTotalStorage))));
  }
  await Promise.all(ops);
}

export async function getCurrentUsage(db: D1Database): Promise<number> {
  const row = await db
    .prepare('SELECT COALESCE(SUM(file_size), 0) AS total FROM videos')
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function getAdminUserId(db: D1Database): Promise<number | null> {
  const value = await readKey(db, 'admin_user_id');
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function claimAdmin(
  db: D1Database,
  userId: number
): Promise<{ currentAdminId: number | null; newlyClaimed: boolean; isAdmin: boolean }> {
  const insert = await db
    .prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_user_id', ?)`)
    .bind(String(userId))
    .run();
  const newlyClaimed = insert.meta?.changes === 1;
  const currentAdminId = await getAdminUserId(db);
  return {
    currentAdminId,
    newlyClaimed,
    isAdmin: currentAdminId === userId,
  };
}
