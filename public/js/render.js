import { els } from './dom.js';
import { icons } from './icons.js';
import { state, tokenFor } from './state.js';
import { escapeHtml, formatBytes, kindText } from './utils.js';

export function displayServer() {
  els.serverLabel.textContent = '已连接电脑端';
  els.serverInput.value = state.server;
}

export function renderLibraries(onOpenLibrary) {
  els.libraryTabs.innerHTML = '';
  if (!state.libraries.length) {
    els.libraryHint.textContent = '服务端没有配置媒体库';
    return;
  }

  const fragment = document.createDocumentFragment();
  state.libraries.forEach((library) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `library-tab ${state.activeLibraryId === library.id ? 'active' : ''}`;
    button.innerHTML = `
      <span>${escapeHtml(library.name)}</span>
      ${library.locked && !tokenFor(library.id) ? icons.lock : ''}
    `;
    button.addEventListener('click', () => onOpenLibrary(library.id));
    fragment.appendChild(button);
  });
  els.libraryTabs.appendChild(fragment);
  els.libraryHint.textContent = `${state.libraries.length} 个可用媒体库`;
}

export function renderLoading() {
  const library = activeLibrary();
  els.folderTitle.textContent = library?.name || '文件';
  els.pathLabel.textContent = state.path ? `/${state.path}` : '/';
  els.backButton.disabled = !state.path;
  els.countLabel.textContent = '正在读取...';
  els.browserList.innerHTML = '<div class="empty-state"><strong>正在扫描文件夹</strong><span>只会显示可播放的音频、视频和子文件夹。</span></div>';
}

export function renderBrowser(onOpenFolder, onPlayItem) {
  const folders = state.items.filter((item) => item.type === 'folder').length;
  const files = state.items.length - folders;
  const library = activeLibrary();
  els.folderTitle.textContent = library?.name || '文件';
  els.pathLabel.textContent = state.path ? `/${state.path}` : '/';
  els.backButton.disabled = !state.path;
  els.countLabel.textContent = `${folders} 个文件夹 · ${files} 个媒体文件`;

  if (!state.items.length) {
    els.browserList.innerHTML = `
      <div class="empty-state">
        <strong>这里没有可播放文件</strong>
        <span>支持 mp3、m4a、flac、wav、ogg、mp4、mov、webm、mkv 等常见格式。</span>
      </div>
    `;
    return;
  }

  els.browserList.innerHTML = '';
  const fragment = document.createDocumentFragment();
  state.items.forEach((item) => fragment.appendChild(createRow(item, onOpenFolder, onPlayItem)));
  els.browserList.appendChild(fragment);
}

export function renderError(title, detail) {
  els.countLabel.textContent = '需要处理';
  els.browserList.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

export function renderPlaylist(onPlayIndex) {
  if (!state.queue.length) {
    els.playlist.innerHTML = '';
    return;
  }
  els.playlist.innerHTML = '';
  state.queue.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `playlist-row ${index === state.queueIndex ? 'active' : ''}`;
    button.textContent = item.name;
    button.addEventListener('click', () => onPlayIndex(index));
    els.playlist.appendChild(button);
  });
}

export function showPasswordDialog(library) {
  state.pendingUnlock = library;
  els.passwordTitle.textContent = `解锁 ${library.name}`;
  els.passwordHint.textContent = '密码会在浏览器中用 RSA-OAEP 加密后发送到服务端。';
  els.passwordInput.value = '';
  els.passwordDialog.showModal();
  setTimeout(() => els.passwordInput.focus(), 80);
}

export function setLibraryLoading() {
  els.libraryHint.textContent = '正在连接服务器...';
  els.libraryTabs.innerHTML = '<div class="empty-state compact"><strong>正在读取媒体库</strong></div>';
}

function createRow(item, onOpenFolder, onPlayItem) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `media-row ${state.activePath === item.path ? 'active' : ''}`;
  button.innerHTML = `
    <span class="media-icon">${icons[item.type === 'folder' ? 'folder' : item.kind]}</span>
    <span class="media-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${kindText(item)}</span>
    </span>
    <span class="media-meta">${item.type === 'file' ? formatBytes(item.size) : ''}</span>
  `;
  button.addEventListener('click', () => {
    if (item.type === 'folder') onOpenFolder(item.path);
    else onPlayItem(item);
  });
  return button;
}

function activeLibrary() {
  return state.libraries.find((item) => item.id === state.activeLibraryId);
}
