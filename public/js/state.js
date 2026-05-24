export const state = {
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
  pendingUnlock: null,
  adminToken: sessionStorage.getItem('rmp.adminToken') || '',
  adminLibraries: []
};

export function baseUrl() {
  return state.server.replace(/\/+$/, '');
}

export function setServer(value) {
  state.server = value.trim().replace(/\/+$/, '');
  localStorage.setItem('rmp.server', state.server);
}

export function tokenFor(libraryId) {
  return state.tokens[libraryId] || '';
}

export function setToken(libraryId, token) {
  state.tokens[libraryId] = token;
  sessionStorage.setItem('rmp.tokens', JSON.stringify(state.tokens));
}

export function setAdminToken(token) {
  state.adminToken = token;
  sessionStorage.setItem('rmp.adminToken', token);
}
