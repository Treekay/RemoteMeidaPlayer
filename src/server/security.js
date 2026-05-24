import crypto from 'node:crypto';

const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export function createSecurityService() {
  const tokens = new Map();
  const rsaKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const keyId = crypto.randomBytes(12).toString('hex');

  return {
    getPublicKey() {
      const publicKey = crypto.createPublicKey(rsaKeys.publicKey);
      return {
        keyId,
        algorithm: 'RSA-OAEP-256',
        publicKey: publicKey.export({ format: 'jwk' })
      };
    },

    decryptPassword(encryptedPassword, incomingKeyId) {
      if (incomingKeyId !== keyId) {
        const error = new Error('加密密钥已过期，请重试');
        error.status = 400;
        throw error;
      }

      const encrypted = Buffer.from(String(encryptedPassword || ''), 'base64');
      return crypto
        .privateDecrypt(
          {
            key: rsaKeys.privateKey,
            oaepHash: 'sha256',
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
          },
          encrypted
        )
        .toString('utf8');
    },

    createToken(libraryId) {
      const token = crypto.randomBytes(32).toString('base64url');
      tokens.set(token, { libraryId, expiresAt: Date.now() + SESSION_TTL_MS });
      return token;
    },

    tokenAllows(req, library, url) {
      if (!library.locked) return true;
      cleanupTokens(tokens);
      const token = readToken(req, url);
      const session = tokens.get(token);
      return Boolean(session && session.libraryId === library.id && session.expiresAt > Date.now());
    },

    ttlSeconds: Math.floor(SESSION_TTL_MS / 1000)
  };
}

export function verifyPassword(library, password) {
  if (!library.locked) return true;
  if (library.passwordHash) return timingSafeEqualText(sha256(password), library.passwordHash);
  return timingSafeEqualText(password, library.password);
}

function readToken(req, url) {
  const auth = req.headers.authorization || '';
  const headerToken = auth.startsWith('Bearer ') ? auth.slice(7) : req.headers['x-library-token'];
  return headerToken || url.searchParams.get('token') || '';
}

function cleanupTokens(tokens) {
  const now = Date.now();
  for (const [token, session] of tokens) {
    if (session.expiresAt <= now) tokens.delete(token);
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
