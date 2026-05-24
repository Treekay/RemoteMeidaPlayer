import { adminHeaders, authHeaders, fetchJson } from './api.js';
import { canEncryptInBrowser, encryptPassword } from './crypto.js';
import { els } from './dom.js';
import { closeCurrentFile, openFileFromFolder, playNext, playQueueIndex } from './player.js';
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
import { setAdminToken, setServer, setToken, state, tokenFor } from './state.js';

async function loadLibraries() {
  setLibraryLoading();

  try {
    const data = await fetchJson('/api/libraries');
    state.libraries = data.libraries || [];
    els.adminButton.hidden = !data.adminEnabled;
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

async function openAdmin() {
  els.adminDialog.showModal();
  els.adminSaveHint.textContent = '';
  if (state.adminToken) {
    await loadAdminConfig();
    return;
  }
  els.adminLogin.hidden = false;
  els.adminEditor.hidden = true;
  els.adminPasswordInput.value = '';
  setTimeout(() => els.adminPasswordInput.focus(), 80);
}

async function unlockAdmin() {
  if (!canEncryptInBrowser()) {
    els.adminLoginHint.textContent = '当前页面不支持浏览器加密能力，请用 HTTPS 访问。/ Browser encryption is unavailable. Use HTTPS.';
    return;
  }
  if (!els.adminPasswordInput.value) {
    els.adminLoginHint.textContent = '请输入管理员密码 / Enter the admin password.';
    return;
  }
  els.adminUnlockButton.disabled = true;
  els.adminLoginHint.textContent = '正在验证... / Verifying...';
  try {
    const keyInfo = await fetchJson('/api/crypto-key');
    const encryptedPassword = await encryptPassword(els.adminPasswordInput.value, keyInfo.publicKey);
    const data = await fetchJson('/api/admin/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyId: keyInfo.keyId, encryptedPassword })
    });
    setAdminToken(data.token);
    await loadAdminConfig();
  } catch (error) {
    els.adminLoginHint.textContent = error.message || '管理员验证失败 / Admin unlock failed.';
  } finally {
    els.adminUnlockButton.disabled = false;
  }
}

async function loadAdminConfig() {
  try {
    const data = await fetchJson('/api/admin/config', { headers: adminHeaders() });
    state.adminLibraries = data.libraries || [];
    els.adminPublicUrl.value = data.publicUrl || '';
    els.adminLogin.hidden = true;
    els.adminEditor.hidden = false;
    renderAdminLibraries();
  } catch (error) {
    setAdminToken('');
    els.adminLogin.hidden = false;
    els.adminEditor.hidden = true;
    els.adminLoginHint.textContent = error.message || '请重新输入管理员密码 / Enter the admin password again.';
  }
}

function renderAdminLibraries() {
  els.adminLibraryList.innerHTML = '';
  state.adminLibraries.forEach((library, index) => {
    const card = document.createElement('div');
    card.className = 'admin-library';
    card.innerHTML = `
      <label>显示名称 / Display name<input data-field="name" value="${escapeAttr(library.name)}" /></label>
      <label>电脑端文件夹路径 / Folder path<input data-field="path" value="${escapeAttr(library.path)}" /></label>
      <label class="password-toggle"><input data-field="locked" type="checkbox" ${library.locked ? 'checked' : ''} />需要密码才能打开 / Require password</label>
      <input data-field="password" type="password" placeholder="${library.passwordSet ? '留空则保留原密码 / Blank keeps current password' : '访问密码 / Access password'}" />
      <button class="ghost-button" type="button">删除 / Delete</button>
    `;
    card.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => updateAdminLibrary(index, card));
      input.addEventListener('change', () => updateAdminLibrary(index, card));
    });
    card.querySelector('button').addEventListener('click', () => {
      state.adminLibraries.splice(index, 1);
      renderAdminLibraries();
    });
    els.adminLibraryList.appendChild(card);
  });
}

function updateAdminLibrary(index, card) {
  const library = state.adminLibraries[index];
  if (!library) return;
  library.name = card.querySelector('[data-field="name"]').value;
  library.path = card.querySelector('[data-field="path"]').value;
  library.locked = card.querySelector('[data-field="locked"]').checked;
  library.password = card.querySelector('[data-field="password"]').value;
}

function addAdminLibrary() {
  state.adminLibraries.push({
    id: `library-${Date.now()}`,
    name: '我的媒体 / My Media',
    path: '',
    locked: false,
    password: '',
    passwordSet: false
  });
  renderAdminLibraries();
}

async function saveAdminConfig() {
  els.adminSave.disabled = true;
  els.adminSaveHint.textContent = '正在保存... / Saving...';
  try {
    const payload = {
      publicUrl: els.adminPublicUrl.value,
      libraries: state.adminLibraries.map((library) => ({
        id: library.id,
        name: library.name,
        path: library.path,
        locked: library.locked,
        password: library.password || ''
      }))
    };
    await fetchJson('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminHeaders() },
      body: JSON.stringify(payload)
    });
    els.adminSaveHint.textContent = '已保存 / Saved.';
    await loadLibraries();
  } catch (error) {
    els.adminSaveHint.textContent = error.message || '保存失败 / Save failed.';
  } finally {
    els.adminSave.disabled = false;
  }
}

function escapeAttr(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
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
  openFileFromFolder(item, renderCurrentBrowser, renderCurrentPlaylist);
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
  els.adminButton.addEventListener('click', openAdmin);
  els.adminClose.addEventListener('click', () => els.adminDialog.close());
  els.adminUnlockButton.addEventListener('click', unlockAdmin);
  els.adminPasswordInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') unlockAdmin();
  });
  els.adminAddLibrary.addEventListener('click', addAdminLibrary);
  els.adminSave.addEventListener('click', saveAdminConfig);

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
  els.closePlayerButton.addEventListener('click', () => {
    closeCurrentFile(renderCurrentBrowser, renderCurrentPlaylist);
  });
  els.previewClose.addEventListener('click', () => {
    els.previewDialog.close();
    els.previewBody.innerHTML = '';
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
