const state = {
  server: localStorage.getItem('rmp.server') || '',
  libraries: [],
  tokens: JSON.parse(sessionStorage.getItem('rmp.tokens') || '{}'),
  activeLibraryId: '',
  path: '',
  parent: '',
  items: [],
  activePath: '',
  queue: [],
  queueIndex: -1,
  pendingUnlock: null
};

const els = {
  serverLabel: document.querySelector('#serverLabel'),
  settingsButton: document.querySelector('#settingsButton'),
  connectPanel: document.querySelector('#connectPanel'),
  serverInput: document.querySelector('#serverInput'),
  connectButton: document.querySelector('#connectButton'),
  refreshLibrariesButton: document.querySelector('#refreshLibrariesButton'),
  libraryTabs: document.querySelector('#libraryTabs'),
  libraryHint: document.querySelector('#libraryHint'),
  backButton: document.querySelector('#backButton'),
  pathLabel: document.querySelector('#pathLabel'),
  folderTitle: document.querySelector('#folderTitle'),
  countLabel: document.querySelector('#countLabel'),
  refreshButton: document.querySelector('#refreshButton'),
  browserList: document.querySelector('#browserList'),
  playerDock: document.querySelector('#playerDock'),
  kindBadge: document.querySelector('#kindBadge'),
  nowTitle: document.querySelector('#nowTitle'),
  playlistButton: document.querySelector('#playlistButton'),
  playlist: document.querySelector('#playlist'),
  audio: document.querySelector('#audioPlayer'),
  video: document.querySelector('#videoPlayer'),
  passwordDialog: document.querySelector('#passwordDialog'),
  passwordForm: document.querySelector('#passwordForm'),
  passwordTitle: document.querySelector('#passwordTitle'),
  passwordHint: document.querySelector('#passwordHint'),
  passwordInput: document.querySelector('#passwordInput'),
  unlockButton: document.querySelector('#unlockButton')
};

const icons = {
  folder: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/></svg>',
  audio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 10 5-3v10l-5-3v-4Z"/><rect width="12" height="12" x="3" y="6" rx="2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="10" x="5" y="11" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
};

function baseUrl() {
  return state.server.replace(/\/+$/, '');
}

function apiUrl(pathname) {
  return `${baseUrl()}${pathname}`;
}

function displayServer() {
  const value = state.server || window.location.origin;
  els.serverLabel.textContent = value;
  els.serverInput.value = state.server;
}

function tokenFor(libraryId) {
  return state.tokens[libraryId] || '';
}

function saveTokens() {
  sessionStorage.setItem('rmp.tokens', JSON.stringify(state.tokens));
}

function authHeaders(libraryId) {
  const token = tokenFor(libraryId);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson(pathname, options = {}) {
  const res = await fetch(apiUrl(pathname), options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error || '请求失败');
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function kindText(item) {
  if (item.type === 'folder') return '文件夹';
  return item.kind === 'video' ? '视频' : '音频';
}

async function loadLibraries() {
  els.libraryHint.textContent = '正在连接服务器...';
  els.libraryTabs.innerHTML = '<div class="empty-state compact"><strong>正在读取媒体库</strong></div>';

  try {
    const data = await fetchJson('/api/libraries');
    state.libraries = data.libraries || [];
    if (!state.activeLibraryId || !state.libraries.some((item) => item.id === state.activeLibraryId)) {
      state.activeLibraryId = state.libraries[0]?.id || '';
    }
    renderLibraries();
    if (state.activeLibraryId) await openLibrary(state.activeLibraryId, false);
  } catch (error) {
    state.libraries = [];
    state.items = [];
    els.libraryHint.textContent = '连接失败';
    els.libraryTabs.innerHTML = '';
    renderError('无法连接服务器', `${error.message}。请确认服务端已启动，手机和电脑在同一网络。`);
  }
}

function renderLibraries() {
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
    button.addEventListener('click', () => openLibrary(library.id));
    fragment.appendChild(button);
  });
  els.libraryTabs.appendChild(fragment);
  els.libraryHint.textContent = `${state.libraries.length} 个可用媒体库`;
}

async function openLibrary(libraryId, resetPath = true) {
  const library = state.libraries.find((item) => item.id === libraryId);
  if (!library) return;

  if (library.locked && !tokenFor(library.id)) {
    askPassword(library);
    return;
  }

  state.activeLibraryId = libraryId;
  if (resetPath) state.path = '';
  renderLibraries();
  await loadFolder(resetPath ? '' : state.path);
}

async function loadFolder(nextPath = state.path) {
  if (!state.activeLibraryId) return;
  state.path = nextPath || '';
  renderLoading();

  const query = new URLSearchParams({ library: state.activeLibraryId, path: state.path });
  try {
    const data = await fetchJson(`/api/list?${query}`, { headers: authHeaders(state.activeLibraryId) });
    state.path = data.path || '';
    state.parent = data.parent || '';
    state.items = data.items || [];
    state.activeLibraryId = data.library?.id || state.activeLibraryId;
    renderBrowser();
  } catch (error) {
    if (error.status === 401) {
      const library = state.libraries.find((item) => item.id === state.activeLibraryId);
      if (library) askPassword(library);
      return;
    }
    renderError('无法读取媒体库', error.message);
  }
}

function renderLoading() {
  const library = state.libraries.find((item) => item.id === state.activeLibraryId);
  els.folderTitle.textContent = library?.name || '文件';
  els.pathLabel.textContent = state.path ? `/${state.path}` : '/';
  els.backButton.disabled = !state.path;
  els.countLabel.textContent = '正在读取...';
  els.browserList.innerHTML = '<div class="empty-state"><strong>正在扫描文件夹</strong><span>只会显示可播放的音频、视频和子文件夹。</span></div>';
}

function renderBrowser() {
  const folders = state.items.filter((item) => item.type === 'folder').length;
  const files = state.items.length - folders;
  const library = state.libraries.find((item) => item.id === state.activeLibraryId);
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
  state.items.forEach((item) => fragment.appendChild(createRow(item)));
  els.browserList.appendChild(fragment);
}

function renderError(title, detail) {
  els.countLabel.textContent = '需要处理';
  els.browserList.innerHTML = `
    <div class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(detail)}</span>
    </div>
  `;
}

function createRow(item) {
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
    if (item.type === 'folder') {
      loadFolder(item.path);
    } else {
      playFromFolder(item);
    }
  });
  return button;
}

function playFromFolder(item) {
  state.queue = state.items.filter((entry) => entry.type === 'file');
  state.queueIndex = Math.max(0, state.queue.findIndex((entry) => entry.path === item.path));
  playQueueIndex(state.queueIndex);
}

function mediaSrc(item) {
  const token = tokenFor(state.activeLibraryId);
  const url = new URL(apiUrl(item.url), window.location.href);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

function playQueueIndex(index) {
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
  player.src = mediaSrc(item);
  player.play().catch(() => {});

  els.kindBadge.textContent = item.kind === 'video' ? '视频' : '音频';
  els.nowTitle.textContent = item.name;
  els.playerDock.hidden = false;
  renderBrowser();
  renderPlaylist();
}

function playNext() {
  if (state.queueIndex + 1 < state.queue.length) playQueueIndex(state.queueIndex + 1);
}

function renderPlaylist() {
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
    button.addEventListener('click', () => playQueueIndex(index));
    els.playlist.appendChild(button);
  });
}

function askPassword(library) {
  state.pendingUnlock = library;
  els.passwordTitle.textContent = `解锁 ${library.name}`;
  els.passwordHint.textContent = '密码会在浏览器中用 RSA-OAEP 加密后发送到服务端。';
  els.passwordInput.value = '';
  els.passwordDialog.showModal();
  setTimeout(() => els.passwordInput.focus(), 80);
}

async function unlockPendingLibrary() {
  const library = state.pendingUnlock;
  if (!library) return;
  if (!window.crypto?.subtle) {
    els.passwordHint.textContent = '当前页面不支持浏览器加密能力。请用 HTTPS 访问服务端后再解锁。';
    return;
  }
  const password = els.passwordInput.value;
  if (!password) {
    els.passwordHint.textContent = '请输入密码。';
    return;
  }

  els.unlockButton.disabled = true;
  els.passwordHint.textContent = '正在加密并验证...';
  try {
    const keyInfo = await fetchJson('/api/crypto-key');
    const encryptedPassword = await encryptPassword(password, keyInfo.publicKey);
    const data = await fetchJson('/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        libraryId: library.id,
        keyId: keyInfo.keyId,
        encryptedPassword
      })
    });
    state.tokens[library.id] = data.token;
    saveTokens();
    els.passwordDialog.close();
    state.pendingUnlock = null;
    await openLibrary(library.id);
  } catch (error) {
    els.passwordHint.textContent = error.message || '解锁失败，请重试。';
  } finally {
    els.unlockButton.disabled = false;
  }
}

async function encryptPassword(password, publicJwk) {
  const key = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    key,
    new TextEncoder().encode(password)
  );
  return arrayBufferToBase64(encrypted);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

els.settingsButton.addEventListener('click', () => {
  els.connectPanel.hidden = !els.connectPanel.hidden;
  if (!els.connectPanel.hidden) els.serverInput.focus();
});

els.connectButton.addEventListener('click', () => {
  state.server = els.serverInput.value.trim().replace(/\/+$/, '');
  localStorage.setItem('rmp.server', state.server);
  state.activeLibraryId = '';
  state.path = '';
  displayServer();
  loadLibraries();
});

els.serverInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') els.connectButton.click();
});

els.refreshLibrariesButton.addEventListener('click', loadLibraries);
els.backButton.addEventListener('click', () => loadFolder(state.parent));
els.refreshButton.addEventListener('click', () => loadFolder(state.path));
els.playlistButton.addEventListener('click', () => {
  els.playlist.hidden = !els.playlist.hidden;
});
els.audio.addEventListener('ended', playNext);
els.video.addEventListener('ended', playNext);
els.passwordForm.addEventListener('submit', (event) => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  unlockPendingLibrary();
});
els.passwordDialog.addEventListener('close', () => {
  state.pendingUnlock = null;
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

displayServer();
loadLibraries();
