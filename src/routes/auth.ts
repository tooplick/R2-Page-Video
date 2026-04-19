import { Hono } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { exchangeCodeForToken, getGitHubUser } from '../services/github';
import { signJwt, verifyJwt } from '../services/jwt';
import type { Env, JwtPayload } from '../types';

const auth = new Hono<{ Bindings: Env }>();

function getRedirectUri(c: any): string {
  const url = new URL(c.req.url);
  return `${url.origin}/api/auth/callback`;
}

auth.get('/login', (c) => {
  const state = crypto.randomUUID();
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 300,
  });

  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: getRedirectUri(c),
    scope: 'read:user',
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

auth.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const savedState = getCookie(c, 'oauth_state');

  if (!code || !state || state !== savedState) {
    return c.json({ error: '认证失败：state 验证不通过' }, 400);
  }

  deleteCookie(c, 'oauth_state');

  try {
    const accessToken = await exchangeCodeForToken(
      code,
      c.env.GITHUB_CLIENT_ID,
      c.env.GITHUB_CLIENT_SECRET,
      getRedirectUri(c)
    );

    const user = await getGitHubUser(accessToken);

    const token = await signJwt(
      {
        sub: user.id,
        username: user.login,
        avatar: user.avatar_url,
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      },
      c.env.JWT_SECRET
    );

    setCookie(c, 'token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: 7 * 24 * 3600,
    });

    return c.redirect('/');
  } catch (e: any) {
    return c.json({ error: e.message || '登录失败' }, 500);
  }
});

auth.get('/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) {
    return c.json({ error: '未登录' }, 401);
  }

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: '登录已过期' }, 401);
  }

  return c.json({
    id: payload.sub,
    username: payload.username,
    avatar: payload.avatar,
    is_guest: payload.is_guest === true,
  });
});

auth.post('/guest', async (c) => {
  const token = await signJwt(
    {
      sub: 0,
      username: '游客',
      avatar: '',
      is_guest: true,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
    },
    c.env.JWT_SECRET
  );

  setCookie(c, 'token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 7 * 24 * 3600,
  });

  return c.json({ ok: true, is_guest: true });
});

auth.post('/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

export default auth;
