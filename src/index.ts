import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth';
import videos from './routes/videos';
import upload from './routes/upload';
import admin from './routes/admin';
import settings from './routes/settings';
import { cleanupOrphans } from './services/cleanup';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

let dbInitialized = false;

app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
}));

app.use('/api/*', async (c, next) => {
  if (!dbInitialized) {
    try {
      await c.env.DB.batch([
        c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS videos (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT DEFAULT '',
          filename TEXT NOT NULL,
          content_type TEXT NOT NULL DEFAULT 'video/mp4',
          file_size INTEGER NOT NULL DEFAULT 0,
          r2_key TEXT NOT NULL UNIQUE,
          thumbnail_r2_key TEXT DEFAULT '',
          uploader_github_id INTEGER NOT NULL,
          uploader_username TEXT NOT NULL,
          uploader_avatar_url TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`),
        c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC)'),
        c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos(uploader_github_id)'),
        c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`),
        c.env.DB.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('max_single_video_size', '1000000000')`),
        c.env.DB.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES ('max_total_storage', '9900000000')`),
      ]);
    } catch {
      // already exists
    }
    dbInitialized = true;
  }
  await next();
});

app.route('/api/auth', auth);
app.route('/api/videos', videos);
app.route('/api/upload', upload);
app.route('/api/admin', admin);
app.route('/api/settings', settings);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: err.message || '服务器内部错误' }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(cleanupOrphans(env));
  },
};
