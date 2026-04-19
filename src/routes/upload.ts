import { Hono } from 'hono';
import { authRequired } from '../middleware/auth';
import { getPresignedUrl } from '../services/r2';
import { insertVideo } from '../services/d1';
import type { Env, JwtPayload } from '../types';

type Variables = { user: JwtPayload };

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

upload.use('/*', authRequired);

upload.post('/presign', async (c) => {
  const body = await c.req.json<{
    filename: string;
    contentType: string;
    fileSize: number;
  }>();

  if (!body.filename || !body.contentType || !body.fileSize) {
    return c.json({ error: '缺少必要参数' }, 400);
  }

  if (!body.contentType.startsWith('video/')) {
    return c.json({ error: '仅支持视频文件' }, 400);
  }

  const maxSize = 500 * 1024 * 1024; // 500MB
  if (body.fileSize > maxSize) {
    return c.json({ error: '文件大小不能超过 500MB' }, 400);
  }

  const videoId = crypto.randomUUID();
  const sanitizedFilename = body.filename.replace(/[^a-zA-Z0-9._\-\u4e00-\u9fff]/g, '_');
  const videoKey = `videos/${videoId}/${sanitizedFilename}`;
  const thumbnailKey = `thumbnails/${videoId}.jpg`;

  const videoUrl = await getPresignedUrl(
    c.env.CF_ACCOUNT_ID,
    c.env.R2_ACCESS_KEY_ID,
    c.env.R2_SECRET_ACCESS_KEY,
    'r2-page-video',
    videoKey,
    body.contentType
  );

  const thumbnailUrl = await getPresignedUrl(
    c.env.CF_ACCOUNT_ID,
    c.env.R2_ACCESS_KEY_ID,
    c.env.R2_SECRET_ACCESS_KEY,
    'r2-page-video',
    thumbnailKey,
    'image/jpeg'
  );

  return c.json({
    videoId,
    videoKey,
    thumbnailKey,
    videoUploadUrl: videoUrl,
    thumbnailUploadUrl: thumbnailUrl,
  });
});

upload.post('/complete', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{
    videoId: string;
    videoKey: string;
    thumbnailKey: string;
    title: string;
    description?: string;
    filename: string;
    contentType: string;
    fileSize: number;
  }>();

  if (!body.videoId || !body.videoKey || !body.title || !body.filename) {
    return c.json({ error: '缺少必要参数' }, 400);
  }

  await insertVideo(c.env.DB, {
    id: body.videoId,
    title: body.title,
    description: body.description || '',
    filename: body.filename,
    content_type: body.contentType || 'video/mp4',
    file_size: body.fileSize || 0,
    r2_key: body.videoKey,
    thumbnail_r2_key: body.thumbnailKey || '',
    uploader_github_id: user.sub,
    uploader_username: user.username,
    uploader_avatar_url: user.avatar,
  });

  return c.json({ ok: true, videoId: body.videoId });
});

export default upload;
