export function createVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'pin-card';
  card.onclick = () => { window.location.hash = `#/video/${video.id}`; };

  const sizeStr = formatFileSize(video.file_size);
  const dateStr = formatDate(video.created_at);

  card.innerHTML = `
    <img class="pin-image"
         src="${video.thumbnail_r2_key ? `/api/videos/${video.id}/thumbnail` : ''}"
         alt="${video.title}"
         loading="lazy">
    <button class="pin-save-btn" onclick="event.stopPropagation();window.location.href='/api/videos/${video.id}/download'">下载</button>
    <div class="pin-info">
      <div class="pin-title" title="${video.title}">${video.title}</div>
      <div class="pin-meta">
        <img src="${video.uploader_avatar_url}" alt="">
        <span>${video.uploader_username}</span>
        <span class="file-size">${sizeStr}</span>
      </div>
    </div>
  `;

  return card;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'Z');
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + ' 天前';
  return d.toLocaleDateString('zh-CN');
}
