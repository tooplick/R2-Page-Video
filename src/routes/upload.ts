import { Hono } from 'hono';
import { authRequired, notGuest } from '../middleware/auth';
import { getPresignedUrl } from '../services/r2';
import { insertVideo } from '../services/d1';
import { getSettings, getCurrentUsage } from '../services/settings';
import type { Env, JwtPayload } from '../types';

type Variables = { user: JwtPayload };

const upload = new Hono<{ Bindings: Env; Variables: Variables }>();

upload.use('/*', authRequired, notGuest);

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

  const [limits, currentUsage] = await Promise.all([
    getSettings(c.env.DB),
    getCurrentUsage(c.env.DB),
  ]);

  if (body.fileSize > limits.maxSingleVideoSize) {
    const limitGb = (limits.maxSingleVideoSize / (1000 * 1000 * 1000)).toFixed(2);
    return c.json({ error: `单文件大小不能超过 ${limitGb} GB` }, 400);
  }

  if (currentUsage + body.fileSize > limits.maxTotalStorage) {
    const usedGb = (currentUsage / (1000 * 1000 * 1000)).toFixed(2);
    const totalGb = (limits.maxTotalStorage / (1000 * 1000 * 1000)).toFixed(2);
    return c.json({ error: `存储空间不足（已用 ${usedGb} / ${totalGb} GB）` }, 400);
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
