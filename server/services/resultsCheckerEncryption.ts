import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { CheckerPin } from '../../shared/resultsCheckers.js';

/** PINs are sellable value, so they use their own key: RESULTS_CHECKER_PIN_KEY, 64 hex characters. */
function encryptionKey(): Buffer {
  const value = process.env.RESULTS_CHECKER_PIN_KEY || '';
  if (!/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('Results checker encryption configuration is invalid.');
  return Buffer.from(value, 'hex');
}
export function isCheckerEncryptionConfigured(): boolean { try { encryptionKey(); return true; } catch { return false; } }

export function encryptPins(orderId: string, pins: readonly CheckerPin[]): string {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`results-checker:v1:${orderId}`));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(pins), 'utf8'), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') });
}

/** The order id is bound in, so an envelope copied onto another order will not open. */
export function decryptPins(orderId: string, envelope: string): CheckerPin[] {
  const value = JSON.parse(envelope);
  if (value.v !== 1) throw new Error('Unsupported results checker encryption version.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(value.iv, 'base64'));
  decipher.setAAD(Buffer.from(`results-checker:v1:${orderId}`)); decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(value.data, 'base64')), decipher.final()]).toString('utf8'));
}
