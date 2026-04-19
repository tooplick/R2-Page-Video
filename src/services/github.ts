import type { GitHubUser } from '../types';

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await res.json<{ access_token?: string; error?: string }>();
  if (!data.access_token) {
    throw new Error(data.error || 'GitHub OAuth token 交换失败');
  }
  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'R2-Page-Video',
    },
  });

  if (!res.ok) {
    throw new Error('获取 GitHub 用户信息失败');
  }

  const user = await res.json<GitHubUser>();
  return { id: user.id, login: user.login, avatar_url: user.avatar_url };
}
