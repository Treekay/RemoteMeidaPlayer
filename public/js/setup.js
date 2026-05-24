const els = {
  list: document.querySelector('#setupList'),
  addButton: document.querySelector('#addLibraryButton'),
  saveButton: document.querySelector('#saveButton'),
  saveStatus: document.querySelector('#saveStatus'),
  template: document.querySelector('#libraryTemplate'),
  primaryUrlButton: document.querySelector('#primaryUrlButton'),
  qrImage: document.querySelector('#qrImage'),
  urlList: document.querySelector('#urlList')
};

const state = {
  libraries: [],
  access: null
};

async function fetchJson(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

async function loadSetup() {
  els.saveStatus.textContent = '正在读取设置...';
  try {
    const data = await fetchJson('/api/setup');
    state.libraries = data.libraries || [];
    state.access = data.access;
    renderLibraries();
    renderAccess();
    els.saveStatus.textContent = '设置会保存在这台电脑上。';
  } catch (error) {
    els.saveStatus.textContent = error.message;
  }
}

function renderLibraries() {
  els.list.innerHTML = '';
  if (!state.libraries.length) addLibrary();
  state.libraries.forEach((library) => els.list.appendChild(createLibraryCard(library)));
}

function createLibraryCard(library) {
  const fragment = els.template.content.cloneNode(true);
  const card = fragment.querySelector('.setup-library');
  const name = fragment.querySelector('.library-name');
  const folderPath = fragment.querySelector('.library-path');
  const lock = fragment.querySelector('.library-lock');
  const password = fragment.querySelector('.library-password');
  const choose = fragment.querySelector('.choose-folder');
  const remove = fragment.querySelector('.remove-library');

  card.dataset.id = library.id || '';
  card.dataset.hadPassword = library.hasPassword ? 'true' : 'false';
  name.value = library.name || '';
  folderPath.value = library.path || '';
  lock.checked = Boolean(library.locked);
  password.hidden = !lock.checked;

  lock.addEventListener('change', () => {
    password.hidden = !lock.checked;
    if (!lock.checked) password.value = '';
  });
  choose.addEventListener('click', async () => {
    choose.disabled = true;
    choose.textContent = '选择中';
    try {
      const data = await fetchJson('/api/setup/pick-folder', { method: 'POST' });
      folderPath.value = data.path;
      if (!name.value.trim()) name.value = folderName(data.path);
    } catch (error) {
      els.saveStatus.textContent = error.message;
    } finally {
      choose.disabled = false;
      choose.textContent = '选择';
    }
  });
  remove.addEventListener('click', () => card.remove());

  return fragment;
}

function addLibrary() {
  const library = {
    id: crypto.randomUUID?.() || `library-${Date.now()}`,
    name: '',
    path: '',
    locked: false,
    hasPassword: false
  };
  els.list.appendChild(createLibraryCard(library));
}

async function saveSetup() {
  const libraries = readFormLibraries();
  if (!libraries.length) {
    els.saveStatus.textContent = '至少添加一个媒体文件夹。';
    return;
  }
  if (libraries.some((library) => library.needsPassword)) {
    els.saveStatus.textContent = '新开启密码保护时，请先输入密码。';
    return;
  }

  els.saveButton.disabled = true;
  els.saveStatus.textContent = '正在保存...';
  try {
    const data = await fetchJson('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ libraries })
    });
    state.libraries = data.libraries || [];
    state.access = data.access;
    renderLibraries();
    renderAccess();
    els.saveStatus.textContent = '已保存，手机端刷新后即可看到。';
  } catch (error) {
    els.saveStatus.textContent = error.message;
  } finally {
    els.saveButton.disabled = false;
  }
}

function readFormLibraries() {
  return [...document.querySelectorAll('.setup-library')]
    .map((card, index) => {
      const name = card.querySelector('.library-name').value.trim();
      const folderPath = card.querySelector('.library-path').value.trim();
      const locked = card.querySelector('.library-lock').checked;
      const password = card.querySelector('.library-password').value;
      const hadPassword = card.dataset.hadPassword === 'true';
      const needsPassword = locked && !hadPassword && !password;
      return {
        id: card.dataset.id || `library-${index + 1}`,
        name: name || folderName(folderPath) || `媒体库 ${index + 1}`,
        path: folderPath,
        password: locked ? password : '',
        keepPassword: locked && hadPassword && !password,
        needsPassword
      };
    })
    .filter((library) => library.path);
}

function renderAccess() {
  const urls = state.access?.urls || [];
  const primaryUrl = state.access?.primaryUrl || 'http://localhost:5178';
  els.primaryUrlButton.textContent = primaryUrl;
  els.primaryUrlButton.onclick = () => copyText(primaryUrl);
  els.qrImage.src = `/api/qr?text=${encodeURIComponent(primaryUrl)}`;
  els.urlList.innerHTML = '';
  urls.forEach((url) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = url;
    button.addEventListener('click', () => {
      els.qrImage.src = `/api/qr?text=${encodeURIComponent(url)}`;
      els.primaryUrlButton.textContent = url;
      copyText(url);
    });
    els.urlList.appendChild(button);
  });
}

async function copyText(text) {
  await navigator.clipboard?.writeText(text).catch(() => {});
  els.saveStatus.textContent = '访问地址已复制。';
}

function folderName(value) {
  return String(value || '').split(/[\\/]/).filter(Boolean).at(-1) || '';
}

els.addButton.addEventListener('click', addLibrary);
els.saveButton.addEventListener('click', saveSetup);
loadSetup();
