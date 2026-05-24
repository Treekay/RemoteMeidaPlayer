import { mediaSrc } from './api.js';
import { els } from './dom.js';
import { state } from './state.js';

export function openFileFromFolder(item, renderBrowser, renderPlaylist) {
  if (item.kind === 'audio' || item.kind === 'video') {
    playFromFolder(item, renderBrowser, renderPlaylist);
    return;
  }
  previewItem(item);
}

export function playFromFolder(item, renderBrowser, renderPlaylist) {
  state.queue = state.items.filter((entry) => entry.type === 'file' && (entry.kind === 'audio' || entry.kind === 'video'));
  state.queueIndex = Math.max(0, state.queue.findIndex((entry) => entry.path === item.path));
  playQueueIndex(state.queueIndex, renderBrowser, renderPlaylist);
}

export function playQueueIndex(index, renderBrowser, renderPlaylist) {
  const item = state.queue[index];
  if (!item) return;
  state.queueIndex = index;
  state.activePath = item.path;
  const player = item.kind === 'video' ? els.video : els.audio;
  const other = item.kind === 'video' ? els.audio : els.video;

  other.pause();
  other.hidden = true;
  other.removeAttribute('src');

  player.hidden = false;
  player.src = mediaSrc(state.activeLibraryId, item);
  player.play().catch(() => {});

  els.kindBadge.textContent = item.kind === 'video' ? '视频 / Video' : '音频 / Audio';
  els.nowTitle.textContent = item.name;
  els.playerDock.hidden = false;
  renderBrowser();
  renderPlaylist();
}

export function playNext(renderBrowser, renderPlaylist) {
  if (state.queueIndex + 1 < state.queue.length) {
    playQueueIndex(state.queueIndex + 1, renderBrowser, renderPlaylist);
  }
}

export async function previewItem(item) {
  const src = mediaSrc(state.activeLibraryId, item);
  els.previewTitle.textContent = item.name;
  els.previewKind.textContent = previewLabel(item.kind);
  els.previewOpen.href = src;
  els.previewBody.innerHTML = '';

  if (item.kind === 'image') {
    const img = document.createElement('img');
    img.className = 'preview-image';
    img.alt = item.name;
    img.src = src;
    els.previewBody.appendChild(img);
  } else if (item.kind === 'text') {
    const pre = document.createElement('pre');
    pre.className = 'preview-text';
    pre.textContent = '正在读取... / Loading...';
    els.previewBody.appendChild(pre);
    try {
      const res = await fetch(src);
      pre.textContent = await res.text();
    } catch (error) {
      pre.textContent = `无法读取文本 / Cannot read text: ${error.message}`;
    }
  } else if (item.name.toLowerCase().endsWith('.pdf')) {
    const frame = document.createElement('iframe');
    frame.className = 'preview-frame';
    frame.src = src;
    els.previewBody.appendChild(frame);
  } else {
    const empty = document.createElement('div');
    empty.className = 'preview-empty';
    empty.innerHTML = '<strong>此文档需要用外部应用打开 / Open this document externally</strong><span>浏览器通常不能直接预览 Word、Excel 或 PowerPoint 文件。Most browsers cannot preview Word, Excel, or PowerPoint directly.</span>';
    els.previewBody.appendChild(empty);
  }

  els.previewDialog.showModal();
}

function previewLabel(kind) {
  const labels = {
    image: '图片预览 / Image Preview',
    text: '文本预览 / Text Preview',
    document: '文档预览 / Document Preview'
  };
  return labels[kind] || '预览 / Preview';
}
