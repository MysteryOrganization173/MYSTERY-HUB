/**
 * Password Security and Session Cryptography
 * Uses Node's built-in crypto.scrypt with unique salts and constant-time comparisons.
 */

import crypto from 'node:crypto';

const SCRYPT_KEYLEN = 64;
const SCRYPT_OPTIONS: crypto.ScryptOptions = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

/**
 * Hashes a plaintext password using crypto.scrypt and a cryptographically random 16-byte salt.
 * Formatted as: scrypt$<salt_hex>$<hash_hex>
 */
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Verifies a plaintext password against a stored scrypt hash using constant-time comparison.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!storedHash || !storedHash.startsWith('scrypt$')) {
      return resolve(false);
    }

    const parts = storedHash.split('$');
    if (parts.length !== 3) {
      return resolve(false);
    }

    const salt = parts[1];
    const keyHex = parts[2];
    const keyBuffer = Buffer.from(keyHex, 'hex');

    crypto.scrypt(password, salt, SCRYPT_KEYLEN, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) return resolve(false);
      try {
        if (keyBuffer.length !== derivedKey.length) return resolve(false);
        const match = crypto.timingSafeEqual(keyBuffer, derivedKey);
        resolve(match);
      } catch {
        resolve(false);
      }
    });
  });
}

/**
 * Generates an opaque, cryptographically random 32-byte session token (64 hex characters).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes SHA-256 hash of a session token for secure server-side storage.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}
