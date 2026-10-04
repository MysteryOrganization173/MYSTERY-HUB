/**
 * Authentication Middleware
 * Resolves Bearer session tokens against the database / session store.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthStore } from '../db/authStore.js';
import { UserRecord } from '../types/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: UserRecord;
      sessionToken?: string;
    }
  }
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const parts = authHeader.trim().split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1].trim();
  }
  return null;
}

function requiresPasswordChange(req: Request, res: Response, user: UserRecord): boolean {
  const path = req.originalUrl.split('?')[0].replace(/\/$/, '');
  const allowed = (req.method === 'GET' && path === '/api/auth/me') ||
    (req.method === 'POST' && ['/api/auth/change-password', '/api/auth/logout', '/api/auth/logout-all'].includes(path));
  if (user.must_change_password && !allowed) {
    res.status(403).json({ error: 'Create a new password before continuing.', code: 'PASSWORD_CHANGE_REQUIRED' });
    return true;
  }
  return false;
}

/**
 * Middleware requiring a valid, active user session.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const sessionData = await AuthStore.findSessionByToken(token);
    if (!sessionData) {
      res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
      return;
    }

    const { user } = sessionData;

    if (user.status === 'disabled') {
      res.status(403).json({ error: 'Your account has been disabled. Please contact support.' });
      return;
    }

    // Touch session asynchronously (no need to block request)
    if (requiresPasswordChange(req, res, user)) return;
    res.setHeader('Cache-Control', 'no-store');
    AuthStore.touchSession(token).catch(() => {});

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    console.error('[Auth Middleware] Unexpected error verifying session:', err);
    res.status(500).json({ error: 'Internal error verifying authentication.' });
  }
}

/**
 * Middleware requiring a valid active admin user session.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }

    const sessionData = await AuthStore.findSessionByToken(token);
    if (!sessionData) {
      res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
      return;
    }

    const { user } = sessionData;

    if (user.status === 'disabled') {
      res.status(403).json({ error: 'Your account has been disabled. Access denied.' });
      return;
    }

    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
      return;
    }

    if (requiresPasswordChange(req, res, user)) return;

    AuthStore.touchSession(token).catch(() => {});

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    console.error('[Admin Auth Middleware] Error verifying admin access:', err);
    res.status(500).json({ error: 'Internal error verifying administrator permissions.' });
  }
}

/**
 * Optional authentication middleware: attaches user if valid token exists, but does not block guests.
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return next();
    }

    const sessionData = await AuthStore.findSessionByToken(token);
    if (!sessionData) { res.status(401).json({ error: 'Invalid or expired session. Please log in again.' }); return; }
    if (sessionData.user.status !== 'active') { res.status(403).json({ error: 'Your account has been disabled. Please contact support.' }); return; }
    if (sessionData && sessionData.user.status === 'active') {
      if (requiresPasswordChange(req, res, sessionData.user)) return;
      req.user = sessionData.user;
      req.sessionToken = token;
      AuthStore.touchSession(token).catch(() => {});
    }

    next();
  } catch (err) {
    // A supplied credential must never downgrade to a guest purchase when verification fails.
    res.status(503).json({ error: 'Could not verify your session. Please try again.' });
  }
}
