import { apiGet } from '../api.js';
import { createVideoCard } from '../components/video-card.js';

let currentPage = 1;
const limit = 30;

export async function renderHome() {
  const main = document.getElementById('main');
  main.innerHTML = '<div class="masonry-grid" id="masonry-grid"></div><div class="pagination" id="pagination"></div>';

  currentPage = 1;
  await loadVideos();
}

async function loadVideos() {
  const grid = document.getElementById('masonry-grid');
  const pagination = document.getElementById('pagination');

  try {
    const data = await apiGet(`/api/videos?page=${currentPage}&limit=${limit}`);
    if (!data) return;

    if (data.videos.length === 0 && currentPage === 1) {
      grid.innerHTML = `
        <div class="empty-state">
          <h2>还没有视频</h2>
        </div>
      `;
      pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = '';
    for (const video of data.videos) {
      grid.appendChild(createVideoCard(video));
    }

    const totalPages = Math.ceil(data.total / limit);
    if (totalPages > 1) {
      pagination.innerHTML = '';
      if (currentPage > 1) {
        const prev = document.createElement('button');
        prev.className = 'btn btn-secondary';
        prev.textContent = '上一页';
        prev.onclick = () => { currentPage--; loadVideos(); window.scrollTo(0, 0); };
        pagination.appendChild(prev);
      }
      const info = document.createElement('span');
      info.className = 'page-info';
      info.textContent = `${currentPage} / ${totalPages}`;
      pagination.appendChild(info);
      if (currentPage < totalPages) {
        const next = document.createElement('button');
        next.className = 'btn btn-secondary';
        next.textContent = '下一页';
        next.onclick = () => { currentPage++; loadVideos(); window.scrollTo(0, 0); };
        pagination.appendChild(next);
      }
    } else {
      pagination.innerHTML = '';
    }
  } catch (e) {
    grid.innerHTML = `<div class="empty-state"><p>加载失败：${e.message}</p></div>`;
  }
}
