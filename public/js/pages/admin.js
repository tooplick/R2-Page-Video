import { apiGet, apiPost, apiPut } from '../api.js';
import { checkAuth } from '../auth.js';

const GIB = 1024 * 1024 * 1024;

const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const LOCK_ICON = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
const BACK_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;

export async function renderAdmin() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="admin-page"><div class="loading-spinner"></div></div>';

  let claim;
  try {
    claim = await apiPost('/api/admin/claim');
  } catch (e) {
    renderError(main, e.message);
    return;
  }
  if (!claim) return;

  if (!claim.isAdmin) {
    renderNoAccess(main);
    return;
  }

  if (claim.newlyClaimed) {
    await checkAuth();
  }

  let data;
  try {
    data = await apiGet('/api/settings');
  } catch (e) {
    renderError(main, e.message);
    return;
  }
  if (!data) return;

  renderForm(main, data, claim.newlyClaimed);
}

function renderError(main, message) {
  main.innerHTML = `
    <div class="admin-page">
      <div class="empty-state">
        <p>加载失败：${message}</p>
      </div>
    </div>
  `;
}

function renderNoAccess(main) {
  main.innerHTML = `
    <div class="admin-page">
      <a href="#/" class="back-link">${BACK_ICON}<span>返回首页</span></a>
      <div class="no-access">
        <div class="no-access-icon">${LOCK_ICON}</div>
        <h2>无权访问</h2>
        <p>管理员已设置，只有管理员可以查看此页面。</p>
      </div>
    </div>
  `;
}

function renderForm(main, data, newlyClaimed) {
  const singleGb = (data.maxSingleVideoSize / GIB).toFixed(2);
  const totalGb = (data.maxTotalStorage / GIB).toFixed(2);
  const usedGb = (data.currentUsage / GIB).toFixed(2);
  const remainingGb = Math.max(0, (data.maxTotalStorage - data.currentUsage) / GIB).toFixed(2);
  const usedPct = Math.min(100, (data.currentUsage / data.maxTotalStorage) * 100);

  main.innerHTML = `
    <div class="admin-page">
      <a href="#/" class="back-link">${BACK_ICON}<span>返回首页</span></a>
      <header class="admin-header">
        <h1>设置</h1>
        <p class="admin-subtitle">配置上传限额与查看存储使用情况</p>
      </header>

      ${newlyClaimed ? `
        <div class="admin-banner">
          <span class="admin-banner-icon">${CHECK_ICON}</span>
          <span>你已成为管理员</span>
        </div>
      ` : ''}

      <section class="stat-card">
        <div class="stat-label">存储使用</div>
        <div class="stat-value">
          <span class="stat-value-used">${usedGb}</span>
          <span class="stat-value-total">/ ${totalGb} GB</span>
        </div>
        <div class="stat-bar">
          <div class="stat-bar-fill" style="width:${usedPct}%"></div>
        </div>
        <div class="stat-meta">剩余 ${remainingGb} GB · 已用 ${usedPct.toFixed(1)}%</div>
      </section>

      <section class="admin-section">
        <h2 class="admin-section-title">上传限额</h2>
        <form id="settings-form" class="settings-form">
          <div class="form-group">
            <label for="single-input">单文件大小</label>
            <div class="input-with-suffix">
              <input type="number" id="single-input" min="0.1" step="0.1" value="${singleGb}" required>
              <span class="input-suffix">GB</span>
            </div>
            <p class="form-hint">单次上传允许的最大文件</p>
          </div>
          <div class="form-group">
            <label for="total-input">总存储空间</label>
            <div class="input-with-suffix">
              <input type="number" id="total-input" min="0.1" step="0.1" value="${totalGb}" required>
              <span class="input-suffix">GB</span>
            </div>
            <p class="form-hint">所有视频累计占用上限</p>
          </div>
          <p class="settings-status" id="settings-status"></p>
          <button type="submit" class="btn btn-primary" id="save-btn" style="margin-top:20px;padding:10px 20px;font-size:14px;font-weight:700;">保存</button>
        </form>
      </section>
    </div>
  `;

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const singleGbVal = parseFloat(document.getElementById('single-input').value);
    const totalGbVal = parseFloat(document.getElementById('total-input').value);
    const status = document.getElementById('settings-status');
    const btn = document.getElementById('save-btn');

    if (!(singleGbVal > 0) || !(totalGbVal > 0)) {
      status.textContent = '数值必须大于 0';
      status.className = 'settings-status error';
      return;
    }

    btn.disabled = true;
    btn.textContent = '保存中...';
    status.textContent = '';
    status.className = 'settings-status';

    try {
      await apiPut('/api/settings', {
        maxSingleVideoSize: Math.floor(singleGbVal * GIB),
        maxTotalStorage: Math.floor(totalGbVal * GIB),
      });
      status.textContent = '已保存';
      status.className = 'settings-status success';
    } catch (err) {
      status.textContent = '保存失败：' + err.message;
      status.className = 'settings-status error';
    } finally {
      btn.disabled = false;
      btn.textContent = '保存';
    }
  });
}
