import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { AfaPayload } from '../../shared/afa.js';
function encryptionKey(): Buffer {
  const value = process.env.AFA_PII_ENCRYPTION_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('AFA encryption configuration is invalid.');
  return Buffer.from(value, 'hex');
}
export function isAfaEncryptionConfigured(): boolean { try { encryptionKey(); return true; } catch { return false; } }
export function encryptAfaPayload(orderId: string, payload: AfaPayload): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`afa:v1:${orderId}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
}
export function decryptAfaPayload(orderId: string, envelope: string): AfaPayload {
  const value = JSON.parse(envelope);
  if (value.v !== 1) throw new Error('Unsupported AFA encryption version.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(`afa:v1:${orderId}`)); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
}
