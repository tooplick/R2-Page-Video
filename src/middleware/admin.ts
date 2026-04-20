import { createMiddleware } from 'hono/factory';
import { getAdminUserId } from '../services/settings';
import type { Env, JwtPayload } from '../types';

type Variables = {
  user: JwtPayload;
};

export const adminRequired = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const user = c.get('user');
    if (!user || user.is_guest) {
      return c.json({ error: '无权访问' }, 403);
    }
    const adminId = await getAdminUserId(c.env.DB);
    if (adminId === null || adminId !== user.sub) {
      return c.json({ error: '无权访问' }, 403);
    }
    await next();
  }
);
