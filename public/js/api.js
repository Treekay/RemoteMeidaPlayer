import { baseUrl, state, tokenFor } from './state.js';

export function apiUrl(pathname) {
  return `${baseUrl()}${pathname}`;
}

export function authHeaders(libraryId) {
  const token = tokenFor(libraryId);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function adminHeaders() {
  return state.adminToken ? { Authorization: `Bearer ${state.adminToken}` } : {};
}

export async function fetchJson(pathname, options = {}) {
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

export function mediaSrc(libraryId, item) {
  const token = tokenFor(libraryId);
  const url = new URL(apiUrl(item.url), window.location.href);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}
