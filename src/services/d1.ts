import type { Video } from '../types';

export async function listVideos(
  db: D1Database,
  page: number,
  limit: number
): Promise<{ videos: Video[]; total: number }> {
  const offset = (page - 1) * limit;

  const countResult = await db
    .prepare('SELECT COUNT(*) as total FROM videos')
    .first<{ total: number }>();

  const videos = await db
    .prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<Video>();

  return {
    videos: videos.results,
    total: countResult?.total ?? 0,
  };
}

export async function getVideoById(db: D1Database, id: string): Promise<Video | null> {
  return db.prepare('SELECT * FROM videos WHERE id = ?').bind(id).first<Video>();
}

export async function insertVideo(
  db: D1Database,
  video: Omit<Video, 'created_at' | 'updated_at'>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO videos (id, title, description, filename, content_type, file_size, r2_key, thumbnail_r2_key, uploader_github_id, uploader_username, uploader_avatar_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      video.id,
      video.title,
      video.description,
      video.filename,
      video.content_type,
      video.file_size,
      video.r2_key,
      video.thumbnail_r2_key,
      video.uploader_github_id,
      video.uploader_username,
      video.uploader_avatar_url
    )
    .run();
}

export async function deleteVideo(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM videos WHERE id = ?').bind(id).run();
}

export async function getAllR2Keys(db: D1Database): Promise<Set<string>> {
  const rows = await db
    .prepare('SELECT r2_key, thumbnail_r2_key FROM videos')
    .all<{ r2_key: string; thumbnail_r2_key: string }>();

  const keys = new Set<string>();
  for (const row of rows.results) {
    if (row.r2_key) keys.add(row.r2_key);
    if (row.thumbnail_r2_key) keys.add(row.thumbnail_r2_key);
  }
  return keys;
}
