import { apiGet, apiDelete } from '../api.js';
import { getUser } from '../auth.js';

export async function renderVideo(id) {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="video-page"><div class="loading-spinner"></div></div>';

  try {
    const video = await apiGet(`/api/videos/${id}`);
    if (!video) return;

    const user = getUser();
    const isOwner = user && user.id === video.uploader_github_id;
    const sizeStr = formatFileSize(video.file_size);
    const dateStr = new Date(video.created_at + 'Z').toLocaleString('zh-CN');

    main.innerHTML = `
      <div class="video-page">
        <div class="video-player-wrapper">
          <video controls autoplay>
            <source src="/api/videos/${video.id}/stream" type="${video.content_type}">
            您的浏览器不支持视频播放
          </video>
        </div>
        <div class="video-info">
          <h1>${escapeHtml(video.title)}</h1>
          <div class="meta">
            <span class="uploader">
              <img src="${video.uploader_avatar_url}" alt="">
              ${escapeHtml(video.uploader_username)}
            </span>
            <span>${dateStr}</span>
            <span>${sizeStr}</span>
          </div>
          <div class="video-actions">
            <a href="/api/videos/${video.id}/download" class="btn btn-primary">下载视频</a>
            <a href="#/" class="btn btn-secondary">返回首页</a>
            ${isOwner ? '<button class="btn btn-danger" id="delete-btn">删除</button>' : ''}
          </div>
        </div>
        ${video.description ? `<div class="video-description">${escapeHtml(video.description)}</div>` : ''}
      </div>
    `;

    if (isOwner) {
      document.getElementById('delete-btn').addEventListener('click', async () => {
        if (!confirm('确定要删除这个视频吗？')) return;
        try {
          await apiDelete(`/api/videos/${video.id}`);
          window.location.hash = '#/';
        } catch (e) {
          alert('删除失败：' + e.message);
        }
      });
    }
  } catch (e) {
    main.innerHTML = `<div class="video-page"><div class="empty-state"><p>加载失败：${e.message}</p></div></div>`;
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
