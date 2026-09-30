/**
 * Lightweight In-Memory Sliding Window Rate Limiter
 * Protects auth and waitlist endpoints against brute-force and spam abuse.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < options.windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass rate limiting
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const timestamps = (hits.get(ip) || []).filter((t) => now - t < options.windowMs);

    if (timestamps.length >= options.max) {
      res.status(429).json({
        error: options.message || 'Too many requests. Please slow down and try again shortly.',
      });
      return;
    }

    timestamps.push(now);
    hits.set(ip, timestamps);
    next();
  };
}

// 10 login attempts per 5 minutes per IP
export const loginRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 15,
  message: 'Too many login attempts. Please wait a few minutes before trying again.',
});

// 10 signups per 15 minutes per IP
export const signupRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many account creation requests. Please try again later.',
});

// 20 waitlist submissions per 10 minutes per IP
export const waitlistRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 25,
  message: 'Too many requests. Please try again shortly.',
});
