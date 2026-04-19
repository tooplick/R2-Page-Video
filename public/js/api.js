const API_BASE = '';

function dispatchUnauthorized() {
  window.dispatchEvent(new Event('auth:unauthorized'));
}

async function apiRequest(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const opts = {
    ...options,
    credentials: 'same-origin',
  };

  if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof Blob) && !(opts.body instanceof FormData)) {
    opts.headers = {
      ...opts.headers,
      'Content-Type': 'application/json',
    };
    opts.body = JSON.stringify(opts.body);
  }

  const response = await fetch(url, opts);

  if (response.status === 401) {
    dispatchUnauthorized();
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '未知错误');
    throw new Error(text || `请求失败 (${response.status})`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function apiGet(path) {
  return apiRequest(path, { method: 'GET' });
}

export async function apiPost(path, body) {
  return apiRequest(path, { method: 'POST', body });
}

export async function apiDelete(path) {
  return apiRequest(path, { method: 'DELETE' });
}
