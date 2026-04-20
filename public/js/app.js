import { checkAuth, getUser, login, loginAsGuest, isGuest } from './auth.js';
import { renderHeader } from './components/header.js';
import { renderHome } from './pages/home.js';
import { renderVideo } from './pages/video.js';
import { renderUpload } from './pages/upload.js';
import { renderAdmin } from './pages/admin.js';

const PIN_LOGO_LG = `<svg width="48" height="48" viewBox="0 0 24 24" fill="#e60023"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`;

const GITHUB_ICON = `<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

function renderLogin() {
  document.getElementById('header').innerHTML = '';
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="login-page">
      <div class="login-logo">${PIN_LOGO_LG}</div>
      <h1>欢迎来到 VideoHub</h1>
      <p>使用 GitHub 账号登录浏览和上传视频</p>
      <a href="/api/auth/login" class="btn btn-github">${GITHUB_ICON} 使用 GitHub 登录</a>
      <a href="#" class="guest-link" id="guest-login-link">游客登录</a>
    </div>
  `;

  document.getElementById('guest-login-link').addEventListener('click', async (e) => {
    e.preventDefault();
    const link = e.currentTarget;
    if (link.classList.contains('disabled')) return;
    link.classList.add('disabled');
    try {
      await loginAsGuest();
      window.location.hash = '#/';
      router();
    } catch (err) {
      link.classList.remove('disabled');
      alert('游客登录失败：' + err.message);
    }
  });
}

function renderFooter() {
  if (!document.getElementById('footer')) {
    const footer = document.createElement('footer');
    footer.id = 'footer';
    footer.className = 'site-footer';
    footer.innerHTML = 'VideoHub &middot; Powered by Cloudflare';
    document.getElementById('app').appendChild(footer);
  }
}

async function router() {
  const hash = window.location.hash || '#/';

  if (hash === '#/login') {
    renderLogin();
    renderFooter();
    return;
  }

  const user = getUser();
  if (!user) {
    renderLogin();
    renderFooter();
    return;
  }

  renderHeader();
  renderFooter();

  if (hash === '#/' || hash === '#/home' || hash === '') {
    await renderHome();
  } else if (hash.startsWith('#/video/')) {
    const id = hash.replace('#/video/', '');
    await renderVideo(id);
  } else if (hash === '#/upload') {
    if (isGuest()) {
      window.location.hash = '#/';
      return;
    }
    renderUpload();
  } else if (hash === '#/admin') {
    if (isGuest()) {
      window.location.hash = '#/';
      return;
    }
    await renderAdmin();
  } else {
    document.getElementById('main').innerHTML = '<div class="empty-state"><h2>页面不存在</h2></div>';
  }
}

window.addEventListener('auth:unauthorized', () => {
  window.location.hash = '#/login';
});

window.addEventListener('hashchange', router);

(async () => {
  await checkAuth();
  router();
})();
