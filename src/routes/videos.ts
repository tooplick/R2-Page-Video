import { Hono } from 'hono';
import { authRequired, notGuest } from '../middleware/auth';
import { listVideos, getVideoById, updateVideo, deleteVideo } from '../services/d1';
import { getAdminUserId } from '../services/settings';
import { parseRange } from '../services/r2';
import type { Env, JwtPayload } from '../types';

type Variables = { user: JwtPayload };

const videos = new Hono<{ Bindings: Env; Variables: Variables }>();

videos.use('/*', authRequired);

videos.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '20')));

  const result = await listVideos(c.env.DB, page, limit);
  return c.json({ ...result, page, limit });
});

videos.get('/:id', async (c) => {
  const video = await getVideoById(c.env.DB, c.req.param('id'));
  if (!video) {
    return c.json({ error: '视频不存在' }, 404);
  }
  return c.json(video);
});

videos.get('/:id/stream', async (c) => {
  const video = await getVideoById(c.env.DB, c.req.param('id'));
  if (!video) {
    return c.json({ error: '视频不存在' }, 404);
  }

  const rangeHeader = c.req.header('Range');
  const options: R2GetOptions = {};

  if (rangeHeader) {
    const range = parseRange(rangeHeader, video.file_size);
    if (range) {
      options.range = { offset: range.start, length: range.end - range.start + 1 };
    }
  }

  const object = await c.env.R2_BUCKET.get(video.r2_key, options);
  if (!object) {
    return c.json({ error: '视频文件不存在' }, 404);
  }

  const headers: Record<string, string> = {
    'Content-Type': video.content_type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  };

  if (rangeHeader && options.range) {
    const r = options.range as { offset: number; length: number };
    const start = r.offset;
    const end = start + r.length - 1;
    headers['Content-Range'] = `bytes ${start}-${end}/${video.file_size}`;
    headers['Content-Length'] = r.length.toString();
    return new Response(object.body, { status: 206, headers });
  }

  headers['Content-Length'] = video.file_size.toString();
  return new Response(object.body, { status: 200, headers });
});

videos.get('/:id/download', async (c) => {
  const video = await getVideoById(c.env.DB, c.req.param('id'));
  if (!video) {
    return c.json({ error: '视频不存在' }, 404);
  }

  const object = await c.env.R2_BUCKET.get(video.r2_key);
  if (!object) {
    return c.json({ error: '视频文件不存在' }, 404);
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': video.content_type,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(video.filename)}"`,
      'Content-Length': video.file_size.toString(),
    },
  });
});

videos.get('/:id/thumbnail', async (c) => {
  const video = await getVideoById(c.env.DB, c.req.param('id'));
  if (!video || !video.thumbnail_r2_key) {
    return c.json({ error: '封面不存在' }, 404);
  }

  const object = await c.env.R2_BUCKET.get(video.thumbnail_r2_key);
  if (!object) {
    return c.json({ error: '封面文件不存在' }, 404);
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

videos.put('/:id', notGuest, async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ title?: string; description?: string }>();

  const title = (body.title || '').trim();
  if (!title) {
    return c.json({ error: '标题不能为空' }, 400);
  }
  if (title.length > 200) {
    return c.json({ error: '标题不能超过200个字符' }, 400);
  }
  const description = (body.description || '').trim();
  if (description.length > 5000) {
    return c.json({ error: '描述不能超过5000个字符' }, 400);
  }

  const video = await getVideoById(c.env.DB, c.req.param('id'));
  if (!video) {
    return c.json({ error: '视频不存在' }, 404);
  }
  if (video.uploader_github_id !== user.sub) {
    const adminId = await getAdminUserId(c.env.DB);
    if (adminId !== user.sub) {
      return c.json({ error: '无权编辑此视频' }, 403);
    }
  }

  await updateVideo(c.env.DB, video.id, { title, description });
  const updated = await getVideoById(c.env.DB, video.id);
  return c.json(updated);
});

videos.delete('/:id', async (c) => {
  const user = c.get('user');
  const video = await getVideoById(c.env.DB, c.req.param('id'));

  if (!video) {
    return c.json({ error: '视频不存在' }, 404);
  }
  if (video.uploader_github_id !== user.sub) {
    const adminId = await getAdminUserId(c.env.DB);
    if (adminId !== user.sub) {
      return c.json({ error: '无权删除此视频' }, 403);
    }
  }

  await c.env.R2_BUCKET.delete(video.r2_key);
  if (video.thumbnail_r2_key) {
    await c.env.R2_BUCKET.delete(video.thumbnail_r2_key);
  }
  await deleteVideo(c.env.DB, video.id);

  return c.json({ ok: true });
});

export default videos;
