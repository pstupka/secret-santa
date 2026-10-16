import { describe, expect, test } from 'vitest';

import {
  budgetToMinorUnits,
  emptyCreateEventForm,
  toCreateEventInput,
  todayIn,
} from './createEventForm';

describe('create event form', () => {
  test.each([
    ['150', 15000],
    ['99,99', 9999],
    ['99.9', 9990],
    [' 1 000 ', 100000],
    ['0', 0],
  ])('reads the budget "%s" as %i minor units', (budget, minor) => {
    expect(budgetToMinorUnits(budget)).toBe(minor);
  });

  test.each(['abc', '-5', '1.234', '1,2,3', ''])(
    'rejects the budget "%s"',
    (budget) => {
      expect(budgetToMinorUnits(budget)).toBeNull();
    },
  );

  test('builds the request, trimming text and omitting empty optional fields', () => {
    const input = toCreateEventInput(
      {
        ...emptyCreateEventForm(),
        title: '  Wigilia u Kowalskich ',
        exchangeOn: '2026-12-24',
        organizerName: ' Ania ',
        organizerEmail: ' ania@example.com ',
        description: '   ',
      },
      'Europe/Warsaw',
    );

    expect(input).toEqual({
      title: 'Wigilia u Kowalskich',
      exchangeOn: '2026-12-24',
      timezone: 'Europe/Warsaw',
      organizerName: 'Ania',
      organizerEmail: 'ania@example.com',
      description: undefined,
      rules: undefined,
    });
  });

  test('sends a budget with its currency', () => {
    const input = toCreateEventInput(
      { ...emptyCreateEventForm(), budget: '150', budgetCurrency: 'EUR' },
      'Europe/Warsaw',
    );

    expect(input).toMatchObject({ budgetAmount: 15000, budgetCurrency: 'EUR' });
  });

  test('knows today in the event timezone', () => {
    const lateEveningUtc = new Date('2026-12-23T23:30:00Z');

    expect(todayIn('Europe/Warsaw', lateEveningUtc)).toBe('2026-12-24');
    expect(todayIn('America/New_York', lateEveningUtc)).toBe('2026-12-23');
  });
});
