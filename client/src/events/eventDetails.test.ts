import { describe, expect, test } from 'vitest';

import {
  daysUntilExchange,
  exchangeCountdown,
  formatBudget,
  formatExchangeDate,
  participationAction,
} from './eventDetails';

// 2026-12-20 10:00 in Warsaw.
const now = new Date('2026-12-20T09:00:00Z');

describe('countdown to the exchange date', () => {
  test('counts whole days in the event timezone', () => {
    expect(daysUntilExchange('2026-12-24', 'Europe/Warsaw', now)).toBe(4);
  });

  test('uses the event timezone, not the viewer’s', () => {
    // 23:30 UTC on 12-20 is already 12-21 in Warsaw, still 12-20 in New York.
    const lateEvening = new Date('2026-12-20T23:30:00Z');

    expect(daysUntilExchange('2026-12-24', 'Europe/Warsaw', lateEvening)).toBe(
      3,
    );
    expect(
      daysUntilExchange('2026-12-24', 'America/New_York', lateEvening),
    ).toBe(4);
  });

  test('crosses a daylight saving change without rounding errors', () => {
    expect(
      daysUntilExchange('2027-04-10', 'Europe/Warsaw', new Date('2027-03-20')),
    ).toBe(21);
  });

  test.each([
    ['2026-12-31', { kind: 'days', days: 11 }],
    ['2026-12-21', { kind: 'tomorrow' }],
    ['2026-12-20', { kind: 'today' }],
    ['2026-12-19', { kind: 'past' }],
  ])('exchange on %s', (exchangeOn, countdown) => {
    expect(exchangeCountdown(exchangeOn, 'Europe/Warsaw', now)).toEqual(
      countdown,
    );
  });
});

describe('participation action', () => {
  test.each([
    ['open', 'member', 'active', 'decline'],
    ['open', 'member', 'declined', 'rejoin'],
    ['open', 'organizer', 'active', null],
    ['drawn', 'member', 'active', null],
    ['drawn', 'member', 'declined', null],
    ['finished', 'member', 'active', null],
  ] as const)(
    'in an %s event a %s who is %s can %s',
    (eventStatus, role, status, action) => {
      expect(participationAction(eventStatus, { role, status })).toBe(action);
    },
  );
});

describe('formatting', () => {
  test('formats the exchange date in Polish', () => {
    expect(formatExchangeDate('2026-12-24')).toBe('24 grudnia 2026');
  });

  test('formats a whole budget without decimals', () => {
    expect(formatBudget(15000, 'PLN')).toBe('150\u00a0zł');
  });

  test('formats a budget with grosze', () => {
    expect(formatBudget(9999, 'PLN')).toBe('99,99\u00a0zł');
  });

  test('has no budget without an amount or currency', () => {
    expect(formatBudget(null, null)).toBeNull();
    expect(formatBudget(15000, null)).toBeNull();
  });
});
