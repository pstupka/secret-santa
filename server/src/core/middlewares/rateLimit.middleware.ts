import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Clock } from '@shared/clock';

export interface RateLimitOptions {
  // Requests allowed per key within `windowMs`.
  limit: number;
  windowMs: number;
  clock: Clock;
  // Bucket for this request; requests without a key are not limited.
  key: (req: Request) => string | undefined;
}

// Above this many tracked keys, buckets with no recent hits are dropped.
const SWEEP_THRESHOLD = 10_000;

// In-memory sliding-window rate limit (single instance, ADR-0002). Rejected
// requests do not count towards the limit. Responds `429` when exceeded.
const rateLimit = ({ limit, windowMs, clock, key }: RateLimitOptions) => {
  const hits = new Map<string, number[]>();

  const sweep = (since: number) => {
    hits.forEach((times, bucket) => {
      if (times.every((time) => time <= since)) hits.delete(bucket);
    });
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const bucket = key(req);
    if (bucket === undefined) return next();

    const now = clock.now().getTime();
    const since = now - windowMs;
    if (hits.size > SWEEP_THRESHOLD) sweep(since);

    const recent = (hits.get(bucket) ?? []).filter((time) => time > since);
    if (recent.length >= limit) {
      hits.set(bucket, recent);
      const retryAfterSeconds = Math.ceil((recent[0] + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      throw new AppError(httpStatus.TOO_MANY_REQUESTS, 'Too many requests');
    }
    recent.push(now);
    hits.set(bucket, recent);
    return next();
  };
};

// Limits for public endpoints that send email (POST /events, /access-links).
export const PUBLIC_WINDOW_MS = 60 * 60 * 1000;
export const PUBLIC_LIMIT_PER_IP = 5;
export const PUBLIC_LIMIT_PER_EMAIL = 3;

export const limitPublicByIp = (clock: Clock) =>
  rateLimit({
    limit: PUBLIC_LIMIT_PER_IP,
    windowMs: PUBLIC_WINDOW_MS,
    clock,
    key: (req) => req.ip,
  });

// Mount after `validate`, so the target email in `req.body[field]` is normalized.
export const limitPublicByEmail = (clock: Clock, field: string) =>
  rateLimit({
    limit: PUBLIC_LIMIT_PER_EMAIL,
    windowMs: PUBLIC_WINDOW_MS,
    clock,
    key: (req) => {
      // eslint-disable-next-line security/detect-object-injection -- field is a literal at the call site.
      const email = req.body?.[field];
      return typeof email === 'string' ? email.toLowerCase() : undefined;
    },
  });

export default rateLimit;
