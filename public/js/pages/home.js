import { apiGet } from '../api.js';
import { createVideoCard } from '../components/video-card.js';

let currentPage = 1;
const limit = 30;
let cachedVideos = [];
let resizeRaf = null;

function getColumnCount() {
  const w = window.innerWidth;
  if (w <= 576) return 1;
  if (w <= 768) return 2;
  if (w <= 890) return 3;
  if (w <= 1312) return 4;
  if (w <= 1680) return 5;
  return 6;
}

function layoutGrid(grid, videos) {
  const cols = Math.min(getColumnCount(), Math.max(videos.length, 1));
  grid.innerHTML = '';

  const columns = [];
  for (let i = 0; i < cols; i++) {
    const col = document.createElement('div');
    col.className = 'masonry-column';
    columns.push(col);
    grid.appendChild(col);
  }

  videos.forEach((video, i) => {
    columns[i % cols].appendChild(createVideoCard(video));
  });
}

function onResize() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    const grid = document.getElementById('masonry-grid');
    if (grid && cachedVideos.length) layoutGrid(grid, cachedVideos);
  });
}

if (typeof window !== 'undefined' && !window.__masonryResizeBound) {
  window.addEventListener('resize', onResize);
  window.__masonryResizeBound = true;
}

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
      cachedVideos = [];
      grid.innerHTML = `
        <div class="empty-state">
          <h2>还没有视频</h2>
        </div>
      `;
      pagination.innerHTML = '';
      return;
    }

    cachedVideos = data.videos;
    layoutGrid(grid, cachedVideos);

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
