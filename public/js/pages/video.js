import { apiGet, apiDelete } from '../api.js';
import { getUser } from '../auth.js';
import { showConfirm } from '../components/modal.js';

const DEFAULT_TITLE = 'VideoHub';

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

    const videoEl = main.querySelector('video');
    if (videoEl) {
      videoEl.addEventListener('loadedmetadata', () => {
        if (videoEl.videoWidth && videoEl.videoHeight) {
          videoEl.parentElement.style.aspectRatio = `${videoEl.videoWidth} / ${videoEl.videoHeight}`;
        }
      }, { once: true });
      setupMediaSession(videoEl, video);
    }

    if (isOwner) {
      document.getElementById('delete-btn').addEventListener('click', async () => {
        const confirmed = await showConfirm({
          title: '删除这个视频？',
          message: '此操作不可撤销，视频文件和封面都会被永久删除。',
          confirmText: '删除',
          cancelText: '取消',
          danger: true,
        });
        if (!confirmed) return;
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

function setupMediaSession(videoEl, video) {
  document.title = `${video.title} · ${DEFAULT_TITLE}`;

  if (!('mediaSession' in navigator)) return;

  const artwork = video.thumbnail_r2_key
    ? [
        { src: `/api/videos/${video.id}/thumbnail`, sizes: '320x180', type: 'image/jpeg' },
        { src: `/api/videos/${video.id}/thumbnail`, sizes: '640x360', type: 'image/jpeg' },
      ]
    : [];

  navigator.mediaSession.metadata = new MediaMetadata({
    title: video.title,
    artist: video.uploader_username || '未知上传者',
    album: DEFAULT_TITLE,
    artwork,
  });

  const safeSet = (action, handler) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* unsupported */ }
  };

  safeSet('play', () => videoEl.play());
  safeSet('pause', () => videoEl.pause());
  safeSet('seekbackward', (details) => {
    const offset = details.seekOffset || 10;
    videoEl.currentTime = Math.max(0, videoEl.currentTime - offset);
  });
  safeSet('seekforward', (details) => {
    const offset = details.seekOffset || 10;
    const dur = isFinite(videoEl.duration) ? videoEl.duration : Infinity;
    videoEl.currentTime = Math.min(dur, videoEl.currentTime + offset);
  });
  safeSet('seekto', (details) => {
    if (details.fastSeek && 'fastSeek' in videoEl) {
      videoEl.fastSeek(details.seekTime);
    } else {
      videoEl.currentTime = details.seekTime;
    }
  });

  const updatePosition = () => {
    if (!isFinite(videoEl.duration) || videoEl.duration <= 0) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: videoEl.duration,
        playbackRate: videoEl.playbackRate || 1,
        position: Math.min(videoEl.currentTime, videoEl.duration),
      });
    } catch { /* ignore */ }
  };

  videoEl.addEventListener('play', () => {
    navigator.mediaSession.playbackState = 'playing';
    updatePosition();
  });
  videoEl.addEventListener('pause', () => {
    navigator.mediaSession.playbackState = 'paused';
    updatePosition();
  });
  videoEl.addEventListener('loadedmetadata', updatePosition);
  videoEl.addEventListener('ratechange', updatePosition);
  videoEl.addEventListener('seeked', updatePosition);
}

function clearMediaSession() {
  document.title = DEFAULT_TITLE;
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = null;
  try { navigator.mediaSession.playbackState = 'none'; } catch { /* ignore */ }
  for (const action of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto']) {
    try { navigator.mediaSession.setActionHandler(action, null); } catch { /* ignore */ }
  }
}

window.addEventListener('hashchange', () => {
  if (!window.location.hash.startsWith('#/video/')) clearMediaSession();
});

function formatFileSize(bytes) {
  if (bytes < 1000) return bytes + ' B';
  if (bytes < 1000 * 1000) return (bytes / 1000).toFixed(1) + ' KB';
  if (bytes < 1000 * 1000 * 1000) return (bytes / (1000 * 1000)).toFixed(1) + ' MB';
  return (bytes / (1000 * 1000 * 1000)).toFixed(2) + ' GB';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
