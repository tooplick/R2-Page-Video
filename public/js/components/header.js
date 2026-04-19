import { getUser, logout } from '../auth.js';

const PIN_LOGO = `<svg width="24" height="24" viewBox="0 0 24 24" fill="#e60023"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>`;

const GUEST_AVATAR = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%2362625b'><circle cx='12' cy='8' r='4'/><path d='M12 14c-4 0-8 2-8 6v2h16v-2c0-4-4-6-8-6z'/></svg>`;

const LOGOUT_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

export function renderHeader() {
  const header = document.getElementById('header');
  const user = getUser();

  if (!user) {
    header.innerHTML = `
      <nav class="site-header">
        <a class="logo" href="#/">${PIN_LOGO}<span>视频站</span></a>
      </nav>
    `;
    return;
  }

  const isGuest = user.is_guest === true;
  const avatar = isGuest ? GUEST_AVATAR : user.avatar;
  const displayName = isGuest ? '游客' : user.username;
  const userLabel = isGuest
    ? `<span class="guest-tag">${displayName}</span>`
    : `<span class="username">${displayName}</span>`;

  header.innerHTML = `
    <nav class="site-header">
      <a class="logo" href="#/">${PIN_LOGO}<span>VideoHub</span></a>
      <div class="nav-right">
        ${isGuest ? '' : '<a href="#/upload" class="btn btn-primary">上传</a>'}
        <div class="user-info">
          <img class="avatar" src="${avatar}" alt="${displayName}">
          ${userLabel}
        </div>
        <button class="btn btn-icon" id="logout-btn" title="退出" aria-label="退出">${LOGOUT_ICON}</button>
      </div>
    </nav>
  `;

  document.getElementById('logout-btn').addEventListener('click', logout);
}

window.addEventListener('auth:changed', () => renderHeader());
