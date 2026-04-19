let authState = null;

export async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (response.ok) {
      authState = await response.json();
      window.dispatchEvent(new Event('auth:changed'));
    } else {
      authState = null;
    }
  } catch (e) {
    authState = null;
  }
}

export function getUser() {
  return authState;
}

export async function login() {
  window.location.href = '/api/auth/login';
}

export async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch (e) {
    // ignore
  }
  authState = null;
  window.dispatchEvent(new Event('auth:changed'));
  window.location.hash = '#/login';
}
