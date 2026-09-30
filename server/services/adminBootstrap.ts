/**
 * Admin Bootstrap Service
 * Automatically provisions an initial administrative account on startup if configured in environment.
 */

import { AuthStore } from '../db/authStore.js';
import { hashPassword } from '../utils/crypto.js';
import { normalizeEmail, validatePassword } from '../utils/authValidation.js';

export async function bootstrapAdminAccount(): Promise<void> {
  const rawEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const rawPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const rawName = process.env.ADMIN_BOOTSTRAP_NAME || 'Mystery Hub Admin';

  if (!rawEmail || !rawPassword) {
    return; // No admin bootstrap configured
  }

  const email = normalizeEmail(rawEmail);
  if (!email) {
    console.warn('[Admin Bootstrap] ADMIN_BOOTSTRAP_EMAIL is not a valid email address. Skipping bootstrap.');
    return;
  }

  const passValidation = validatePassword(rawPassword);
  if (!passValidation.isValid) {
    console.warn(`[Admin Bootstrap] ADMIN_BOOTSTRAP_PASSWORD fails policy: ${passValidation.error}. Skipping bootstrap.`);
    return;
  }

  try {
    const existing = await AuthStore.findUserByIdentifier(email);
    if (existing) {
      if (existing.role === 'admin') {
        // Admin already exists, do not overwrite password
        return;
      } else {
        console.warn(
          `[Admin Bootstrap] Account with email "${email}" already exists as customer. Refusing to overwrite or silently promote.`
        );
        return;
      }
    }

    // Create new admin account securely
    const passwordHash = await hashPassword(rawPassword);
    const adminId = `usr_adm_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;

    await AuthStore.createUser({
      id: adminId,
      name: rawName.trim(),
      email,
      phone: null,
      passwordHash,
      role: 'admin',
      status: 'active',
    });

    console.log(`[Admin Bootstrap] Successfully provisioned initial admin account for "${email}".`);
    console.log('[Admin Bootstrap] NOTE: You may now remove ADMIN_BOOTSTRAP_PASSWORD from environment variables.');
  } catch (err) {
    console.error('[Admin Bootstrap] Failed to bootstrap admin account:', err);
  }
}
