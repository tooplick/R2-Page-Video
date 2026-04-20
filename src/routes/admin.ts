import { Hono } from 'hono';
import { authRequired, notGuest } from '../middleware/auth';
import { adminRequired } from '../middleware/admin';
import { claimAdmin } from '../services/settings';
import { cleanupOrphans } from '../services/cleanup';
import type { Env, JwtPayload } from '../types';

type Variables = { user: JwtPayload };

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

admin.use('/*', authRequired, notGuest);

admin.post('/claim', async (c) => {
  const user = c.get('user');
  const result = await claimAdmin(c.env.DB, user.sub);
  return c.json({
    isAdmin: result.isAdmin,
    newlyClaimed: result.newlyClaimed,
  });
});

admin.post('/cleanup-orphans', adminRequired, async (c) => {
  const result = await cleanupOrphans(c.env);
  return c.json(result);
});

export default admin;
