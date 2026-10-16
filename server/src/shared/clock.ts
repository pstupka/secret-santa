// Injectable source of "now", so tests can control time (exchange dates,
// token expiry, outbox backoff).
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

// ISO-8601 UTC timestamp, the format of every *_at column.
export const toUtcTimestamp = (date: Date): string => date.toISOString();

export const nowUtc = (clock: Clock): string => toUtcTimestamp(clock.now());
