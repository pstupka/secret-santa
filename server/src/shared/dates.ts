import { Clock } from './clock';

// Event dates are dates only (YYYY-MM-DD) interpreted in the event's IANA timezone.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// True for a real calendar date in YYYY-MM-DD form (rejects e.g. 2026-02-30).
export const isCalendarDate = (value: string): boolean => {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

// True for a timezone the runtime knows, e.g. 'Europe/Warsaw' or 'UTC'.
export const isValidTimezone = (timezone: string): boolean => {
  try {
    // eslint-disable-next-line no-new
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

// Today's date (YYYY-MM-DD) in the given IANA timezone.
export const todayIn = (timezone: string, clock: Clock): string =>
  // en-CA formats dates as YYYY-MM-DD.
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(clock.now());

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole calendar days from `from` to `to` (both YYYY-MM-DD); negative when
// `to` is earlier.
export const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      MS_PER_DAY,
  );
