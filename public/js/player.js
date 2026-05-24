import { mediaSrc } from './api.js';
import { els } from './dom.js';
import { state } from './state.js';

export function playFromFolder(item, renderBrowser, renderPlaylist) {
  state.queue = state.items.filter((entry) => entry.type === 'file');
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

  els.kindBadge.textContent = item.kind === 'video' ? '视频' : '音频';
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
