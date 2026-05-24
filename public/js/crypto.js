import { arrayBufferToBase64 } from './utils.js';

export function canEncryptInBrowser() {
  return Boolean(window.crypto?.subtle);
}

export async function encryptPassword(password, publicJwk) {
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
