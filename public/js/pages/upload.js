import { apiGet, apiPost } from '../api.js';

let thumbnailBlob = null;
let videoFile = null;
let quotaInfo = null;

const GB = 1000 * 1000 * 1000;

export function renderUpload() {
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="upload-page">
      <h1>上传视频</h1>
      <p class="quota-tip" id="quota-tip">加载配额信息...</p>
      <form id="upload-form">
        <div class="form-group">
          <label>视频文件</label>
          <div class="file-input-wrapper" id="file-drop">
            <input type="file" id="video-input" accept="video/*">
            <div class="upload-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#91918c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p class="placeholder" id="file-label">点击或拖拽选择视频文件</p>
          </div>
        </div>
        <div class="thumbnail-preview" id="thumbnail-section" style="display:none;">
          <label>视频封面</label>
          <img id="thumbnail-img" alt="封面预览">
          <div class="thumbnail-controls">
            <span style="font-size:12px;color:var(--text-disabled);">选择封面帧</span>
            <input type="range" id="thumbnail-seek" min="0" max="100" value="0" step="0.1">
            <span class="seek-time" id="seek-time">0:00</span>
          </div>
        </div>
        <div class="form-group">
          <label>标题</label>
          <input type="text" id="title-input" placeholder="给视频取个标题" required>
        </div>
        <div class="form-group">
          <label>描述</label>
          <textarea id="desc-input" placeholder="添加描述（可选）"></textarea>
        </div>
        <div class="progress-bar" id="progress-bar" style="display:none;">
          <div class="progress" id="progress"></div>
        </div>
        <p class="upload-status" id="upload-status"></p>
        <button type="submit" class="btn btn-primary" id="submit-btn" style="margin-top:20px;padding:10px 20px;font-size:14px;font-weight:700;">上传</button>
      </form>
    </div>
  `;

  const videoInput = document.getElementById('video-input');
  const fileDrop = document.getElementById('file-drop');
  const fileLabel = document.getElementById('file-label');
  const titleInput = document.getElementById('title-input');

  fileDrop.addEventListener('click', () => videoInput.click());

  fileDrop.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileDrop.style.borderColor = 'var(--brand-red)';
    fileDrop.style.background = 'var(--surface-sand)';
  });

  fileDrop.addEventListener('dragleave', () => {
    fileDrop.style.borderColor = '';
    fileDrop.style.background = '';
  });

  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.style.borderColor = '';
    fileDrop.style.background = '';
    if (e.dataTransfer.files.length > 0) {
      videoInput.files = e.dataTransfer.files;
      handleFileSelect(e.dataTransfer.files[0], fileLabel, titleInput);
    }
  });

  videoInput.addEventListener('change', () => {
    if (videoInput.files.length > 0) {
      handleFileSelect(videoInput.files[0], fileLabel, titleInput);
    }
  });

  document.getElementById('upload-form').addEventListener('submit', handleUpload);

  loadQuota();
}

async function loadQuota() {
  const tip = document.getElementById('quota-tip');
  try {
    quotaInfo = await apiGet('/api/settings');
    if (!quotaInfo || !tip) return;
    const singleGb = (quotaInfo.maxSingleVideoSize / GB).toFixed(2);
    const totalGb = (quotaInfo.maxTotalStorage / GB).toFixed(2);
    const usedGb = (quotaInfo.currentUsage / GB).toFixed(2);
    tip.textContent = `已用 ${usedGb} / ${totalGb} GB · 单文件 ≤ ${singleGb} GB`;
  } catch {
    if (tip) tip.textContent = '';
  }
}

function handleFileSelect(file, fileLabel, titleInput) {
  if (quotaInfo) {
    if (file.size > quotaInfo.maxSingleVideoSize) {
      const limitGb = (quotaInfo.maxSingleVideoSize / GB).toFixed(2);
      alert(`文件超过单文件限制 ${limitGb} GB`);
      return;
    }
    if (quotaInfo.currentUsage + file.size > quotaInfo.maxTotalStorage) {
      const totalGb = (quotaInfo.maxTotalStorage / GB).toFixed(2);
      const usedGb = (quotaInfo.currentUsage / GB).toFixed(2);
      alert(`存储空间不足（已用 ${usedGb} / ${totalGb} GB）`);
      return;
    }
  }

  videoFile = file;
  fileLabel.className = 'selected-file';
  fileLabel.textContent = `${file.name} (${formatSize(file.size)})`;

  if (!titleInput.value) {
    titleInput.value = file.name.replace(/\.[^/.]+$/, '');
  }

  generateThumbnail(file);
}

function generateThumbnail(file) {
  const section = document.getElementById('thumbnail-section');
  const img = document.getElementById('thumbnail-img');
  const seekBar = document.getElementById('thumbnail-seek');
  const seekTime = document.getElementById('seek-time');

  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;

  const url = URL.createObjectURL(file);
  video.src = url;

  video.addEventListener('loadedmetadata', () => {
    seekBar.max = video.duration;
    video.currentTime = Math.min(1, video.duration * 0.1);
  });

  video.addEventListener('seeked', () => {
    captureFrame(video, img);
    seekTime.textContent = formatTime(video.currentTime);
  });

  seekBar.addEventListener('input', () => {
    video.currentTime = parseFloat(seekBar.value);
  });

  video.addEventListener('loadeddata', () => {
    video.currentTime = Math.min(1, video.duration * 0.1);
    section.style.display = 'block';
  });

  video.addEventListener('error', () => {
    URL.revokeObjectURL(url);
    section.style.display = 'none';
  });
}

function captureFrame(video, imgEl) {
  const canvas = document.createElement('canvas');
  const maxWidth = 640;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = video.videoWidth * scale;
  canvas.height = video.videoHeight * scale;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob((blob) => {
    if (blob) {
      thumbnailBlob = blob;
      imgEl.src = URL.createObjectURL(blob);
    }
  }, 'image/jpeg', 0.8);
}

async function handleUpload(e) {
  e.preventDefault();
  if (!videoFile) { alert('请选择视频文件'); return; }

  const title = document.getElementById('title-input').value.trim();
  if (!title) { alert('请输入标题'); return; }

  const description = document.getElementById('desc-input').value.trim();
  const submitBtn = document.getElementById('submit-btn');
  const progressBar = document.getElementById('progress-bar');
  const progress = document.getElementById('progress');
  const status = document.getElementById('upload-status');

  submitBtn.disabled = true;
  submitBtn.textContent = '上传中...';
  progressBar.style.display = 'block';
  status.textContent = '正在获取上传地址...';

  try {
    const presign = await apiPost('/api/upload/presign', {
      filename: videoFile.name,
      contentType: videoFile.type || 'video/mp4',
      fileSize: videoFile.size,
    });
    if (!presign) return;

    status.textContent = '正在上传视频...';

    await uploadWithProgress(presign.videoUploadUrl, videoFile, videoFile.type || 'video/mp4', (pct) => {
      progress.style.width = pct + '%';
      status.textContent = `正在上传视频... ${pct.toFixed(0)}%`;
    });

    if (thumbnailBlob) {
      status.textContent = '正在上传封面...';
      progress.style.width = '100%';
      await uploadFile(presign.thumbnailUploadUrl, thumbnailBlob, 'image/jpeg');
    }

    status.textContent = '正在保存信息...';
    const result = await apiPost('/api/upload/complete', {
      videoId: presign.videoId,
      videoKey: presign.videoKey,
      thumbnailKey: thumbnailBlob ? presign.thumbnailKey : '',
      title,
      description,
      filename: videoFile.name,
      contentType: videoFile.type || 'video/mp4',
      fileSize: videoFile.size,
    });

    if (result) {
      status.textContent = '上传成功！';
      window.location.hash = `#/video/${result.videoId}`;
    }
  } catch (e) {
    status.textContent = '上传失败：' + e.message;
    submitBtn.disabled = false;
    submitBtn.textContent = '上传';
  }
}

function uploadWithProgress(url, body, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`上传失败 (${xhr.status})`));
    });

    xhr.addEventListener('error', () => reject(new Error('网络错误')));
    xhr.send(body);
  });
}

async function uploadFile(url, body, contentType) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body,
  });
  if (!res.ok) throw new Error('封面上传失败');
}

function formatSize(bytes) {
  if (bytes < 1000 * 1000) return (bytes / 1000).toFixed(1) + ' KB';
  if (bytes < 1000 * 1000 * 1000) return (bytes / (1000 * 1000)).toFixed(1) + ' MB';
  return (bytes / (1000 * 1000 * 1000)).toFixed(2) + ' GB';
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
