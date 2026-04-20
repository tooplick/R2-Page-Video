CREATE TABLE IF NOT EXISTS videos (
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
);

CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_uploader ON videos(uploader_github_id);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('max_single_video_size', '1073741824');
INSERT OR IGNORE INTO settings (key, value) VALUES ('max_total_storage', '10200547328');
