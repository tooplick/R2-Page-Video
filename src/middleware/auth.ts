import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { verifyJwt } from '../services/jwt';
import type { Env, JwtPayload } from '../types';

type Variables = {
  user: JwtPayload;
};

export const authRequired = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token = getCookie(c, 'token');
    if (!token) {
      return c.json({ error: '请先登录' }, 401);
    }

    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: '登录已过期，请重新登录' }, 401);
    }

    c.set('user', payload);
    await next();
  }
);

export const authOptional = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const token = getCookie(c, 'token');
    if (token) {
      const payload = await verifyJwt(token, c.env.JWT_SECRET);
      if (payload) {
        c.set('user', payload);
      }
    }
    await next();
  }
);
