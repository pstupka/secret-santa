import type { EventStatus, ParticipantRole, ParticipantStatus } from '@/api';
import { todayIn } from './createEventForm';

// What a participant can change about taking part in the draw: decline or
// rejoin only while the event is open; the organizer always takes part.
export const participationAction = (
  eventStatus: EventStatus,
  participant: { role: ParticipantRole; status: ParticipantStatus },
): 'decline' | 'rejoin' | null => {
  if (eventStatus !== 'open' || participant.role === 'organizer') return null;
  return participant.status === 'active' ? 'decline' : 'rejoin';
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Days from `from` to `to`, both YYYY-MM-DD.
const daysBetween = (from: string, to: string): number =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      MS_PER_DAY,
  );

// Whole days until the exchange date, counted in the event's timezone:
// 0 on the exchange date itself, negative once it has passed.
export const daysUntilExchange = (
  exchangeOn: string,
  timezone: string,
  now = new Date(),
): number => daysBetween(todayIn(timezone, now), exchangeOn);

// The countdown to the exchange date, as shown on the event dashboard.
export type Countdown =
  | { kind: 'days'; days: number }
  | { kind: 'tomorrow' }
  | { kind: 'today' }
  | { kind: 'past' };

export const exchangeCountdown = (
  exchangeOn: string,
  timezone: string,
  now = new Date(),
): Countdown => {
  const days = daysUntilExchange(exchangeOn, timezone, now);
  if (days < 0) return { kind: 'past' };
  if (days === 0) return { kind: 'today' };
  if (days === 1) return { kind: 'tomorrow' };
  return { kind: 'days', days };
};

// "24 grudnia 2026" for '2026-12-24'. The exchange date is a date only, so it
// is formatted as such, independent of the viewer's timezone.
export const formatExchangeDate = (exchangeOn: string, locale = 'pl-PL') =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${exchangeOn}T00:00:00Z`));

// "150,00 zł" for 15000 PLN; null for an event without a budget.
export const formatBudget = (
  amount: number | null,
  currency: string | null,
  locale = 'pl-PL',
): string | null => {
  if (amount === null || !currency) return null;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
};
