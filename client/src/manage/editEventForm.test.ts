import { describe, expect, test } from 'vitest';

import type { Event } from '@/api';
import {
  editEventFormFrom,
  minorUnitsToBudget,
  timezoneOptions,
  toUpdateEventInput,
} from './editEventForm';

const event: Event = {
  id: 'event-1',
  title: 'Wigilia u Kowalskich',
  description: 'U babci',
  budgetAmount: 15000,
  budgetCurrency: 'PLN',
  rules: null,
  timezone: 'Europe/Warsaw',
  exchangeOn: '2026-12-24',
  status: 'open',
  drawnAt: null,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
};

test('formats a budget in major units with a decimal comma', () => {
  expect(minorUnitsToBudget(15000)).toBe('150');
  expect(minorUnitsToBudget(9999)).toBe('99,99');
  expect(minorUnitsToBudget(5005)).toBe('50,05');
  expect(minorUnitsToBudget(0)).toBe('0');
});

test('fills the form from the event', () => {
  expect(editEventFormFrom(event)).toEqual({
    title: 'Wigilia u Kowalskich',
    exchangeOn: '2026-12-24',
    timezone: 'Europe/Warsaw',
    budget: '150',
    budgetCurrency: 'PLN',
    description: 'U babci',
    rules: '',
  });
});

test('an event without a budget defaults the currency to PLN', () => {
  expect(
    editEventFormFrom({ ...event, budgetAmount: null, budgetCurrency: null }),
  ).toMatchObject({ budget: '', budgetCurrency: 'PLN' });
});

describe('toUpdateEventInput', () => {
  test('nothing changed', () => {
    expect(toUpdateEventInput(editEventFormFrom(event), event)).toEqual({});
  });

  test('only the changed fields, trimmed', () => {
    const form = {
      ...editEventFormFrom(event),
      title: '  Wigilia 2026 ',
      exchangeOn: '2026-12-23',
      rules: ' Bez słodyczy ',
    };

    expect(toUpdateEventInput(form, event)).toEqual({
      title: 'Wigilia 2026',
      exchangeOn: '2026-12-23',
      rules: 'Bez słodyczy',
    });
  });

  test('clears text with an empty field', () => {
    const form = { ...editEventFormFrom(event), description: '  ' };

    expect(toUpdateEventInput(form, event)).toEqual({ description: null });
  });

  test('changes the budget as a pair', () => {
    const form = { ...editEventFormFrom(event), budget: '99,99' };

    expect(toUpdateEventInput(form, event)).toEqual({
      budgetAmount: 9999,
      budgetCurrency: 'PLN',
    });
  });

  test('changes only the budget currency', () => {
    const form = { ...editEventFormFrom(event), budgetCurrency: 'EUR' };

    expect(toUpdateEventInput(form, event)).toEqual({
      budgetAmount: 15000,
      budgetCurrency: 'EUR',
    });
  });

  test('clears the budget', () => {
    const form = { ...editEventFormFrom(event), budget: '' };

    expect(toUpdateEventInput(form, event)).toEqual({
      budgetAmount: null,
      budgetCurrency: null,
    });
  });

  test('changes the timezone', () => {
    const form = { ...editEventFormFrom(event), timezone: 'Europe/London' };

    expect(toUpdateEventInput(form, event)).toEqual({
      timezone: 'Europe/London',
    });
  });
});

test('timezone options always include the current one', () => {
  expect(timezoneOptions('Europe/Warsaw')).toContain('Europe/Warsaw');
  expect(timezoneOptions('Mars/Olympus')[0]).toBe('Mars/Olympus');
});
