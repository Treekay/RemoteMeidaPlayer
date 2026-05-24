import { fetchJson, authHeaders } from './api.js';
import { canEncryptInBrowser, encryptPassword } from './crypto.js';
import { els } from './dom.js';
import { playFromFolder, playNext, playQueueIndex } from './player.js';
import {
  displayServer,
  renderBrowser,
  renderError,
  renderLibraries,
  renderLoading,
  renderPlaylist,
  setLibraryLoading,
  showPasswordDialog
} from './render.js';
import { setServer, setToken, state, tokenFor } from './state.js';

async function loadLibraries() {
  setLibraryLoading();

  try {
    const data = await fetchJson('/api/libraries');
    state.libraries = data.libraries || [];
    if (!state.activeLibraryId || !state.libraries.some((item) => item.id === state.activeLibraryId)) {
      state.activeLibraryId = state.libraries[0]?.id || '';
    }
    renderLibraries(openLibrary);
    if (state.activeLibraryId) await openLibrary(state.activeLibraryId, false);
  } catch (error) {
    state.libraries = [];
    state.items = [];
    els.libraryHint.textContent = '连接失败 / Connection failed';
    els.libraryTabs.innerHTML = '';
    renderError('无法连接服务端 / Cannot connect to server', `${error.message}. 请确认电脑端服务已启动，并且手机和电脑在同一网络 / Make sure the desktop service is running and both devices are on the same network.`);
  }
}

async function openLibrary(libraryId, resetPath = true) {
  const library = state.libraries.find((item) => item.id === libraryId);
  if (!library) return;

  if (library.locked && !tokenFor(library.id)) {
    showPasswordDialog(library);
    return;
  }

  state.activeLibraryId = libraryId;
  if (resetPath) state.path = '';
  renderLibraries(openLibrary);
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
    renderBrowser(loadFolder, playSelectedItem);
  } catch (error) {
    if (error.status === 401) {
      const library = state.libraries.find((item) => item.id === state.activeLibraryId);
      if (library) showPasswordDialog(library);
      return;
    }
    renderError('无法读取媒体库 / Cannot read library', error.message);
  }
}

function playSelectedItem(item) {
  playFromFolder(item, renderCurrentBrowser, renderCurrentPlaylist);
}

function playSelectedIndex(index) {
  playQueueIndex(index, renderCurrentBrowser, renderCurrentPlaylist);
}

function renderCurrentBrowser() {
  renderBrowser(loadFolder, playSelectedItem);
}

function renderCurrentPlaylist() {
  renderPlaylist(playSelectedIndex);
}

async function unlockPendingLibrary() {
  const library = state.pendingUnlock;
  if (!library) return;
  if (!canEncryptInBrowser()) {
    els.passwordHint.textContent = '当前页面不支持浏览器加密能力。请用 HTTPS 访问服务端后再解锁。Browser encryption is unavailable. Use HTTPS to unlock.';
    return;
  }
  const password = els.passwordInput.value;
  if (!password) {
    els.passwordHint.textContent = '请输入密码 / Enter the password.';
    return;
  }

  els.unlockButton.disabled = true;
  els.passwordHint.textContent = '正在加密并验证... / Encrypting and verifying...';
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
    setToken(library.id, data.token);
    els.passwordDialog.close();
    state.pendingUnlock = null;
    await openLibrary(library.id);
  } catch (error) {
    els.passwordHint.textContent = error.message || '解锁失败，请重试 / Unlock failed. Try again.';
  } finally {
    els.unlockButton.disabled = false;
  }
}

function bindEvents() {
  els.settingsButton.addEventListener('click', () => {
    els.connectPanel.hidden = !els.connectPanel.hidden;
    if (!els.connectPanel.hidden) els.serverInput.focus();
  });

  els.connectButton.addEventListener('click', () => {
    setServer(els.serverInput.value);
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
  els.audio.addEventListener('ended', () => playNext(renderCurrentBrowser, renderCurrentPlaylist));
  els.video.addEventListener('ended', () => playNext(renderCurrentBrowser, renderCurrentPlaylist));
  els.passwordForm.addEventListener('submit', (event) => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    unlockPendingLibrary();
  });
  els.passwordDialog.addEventListener('close', () => {
    state.pendingUnlock = null;
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

bindEvents();
registerServiceWorker();
displayServer();
loadLibraries();
