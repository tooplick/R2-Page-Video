import { Hono } from 'hono';
import { authRequired } from '../middleware/auth';
import { adminRequired } from '../middleware/admin';
import {
  getSettings,
  updateSettings,
  getCurrentUsage,
  getAdminUserId,
} from '../services/settings';
import type { Env, JwtPayload } from '../types';

type Variables = { user: JwtPayload };

const settings = new Hono<{ Bindings: Env; Variables: Variables }>();

settings.use('/*', authRequired);

settings.get('/', async (c) => {
  const user = c.get('user');
  const [limits, currentUsage, adminId] = await Promise.all([
    getSettings(c.env.DB),
    getCurrentUsage(c.env),
    getAdminUserId(c.env.DB),
  ]);
  return c.json({
    maxSingleVideoSize: limits.maxSingleVideoSize,
    maxTotalStorage: limits.maxTotalStorage,
    currentUsage,
    isAdmin: adminId !== null && adminId === user.sub && !user.is_guest,
  });
});

settings.put('/', adminRequired, async (c) => {
  const body = await c.req.json<{
    maxSingleVideoSize?: number;
    maxTotalStorage?: number;
  }>();

  const partial: { maxSingleVideoSize?: number; maxTotalStorage?: number } = {};

  if (body.maxSingleVideoSize !== undefined) {
    if (!Number.isFinite(body.maxSingleVideoSize) || body.maxSingleVideoSize <= 0) {
      return c.json({ error: '单文件大小必须为正数' }, 400);
    }
    partial.maxSingleVideoSize = body.maxSingleVideoSize;
  }

  if (body.maxTotalStorage !== undefined) {
    if (!Number.isFinite(body.maxTotalStorage) || body.maxTotalStorage <= 0) {
      return c.json({ error: '总存储空间必须为正数' }, 400);
    }
    partial.maxTotalStorage = body.maxTotalStorage;
  }

  if (Object.keys(partial).length === 0) {
    return c.json({ error: '没有要更新的字段' }, 400);
  }

  await updateSettings(c.env.DB, partial);
  const updated = await getSettings(c.env.DB);
  return c.json({
    maxSingleVideoSize: updated.maxSingleVideoSize,
    maxTotalStorage: updated.maxTotalStorage,
  });
});

export default settings;
