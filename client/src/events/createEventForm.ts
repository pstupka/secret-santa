import type { CreateEventInput } from '@/api';

export const BUDGET_CURRENCIES = ['PLN', 'EUR', 'USD', 'GBP'] as const;

export const FALLBACK_TIMEZONE = 'Europe/Warsaw';

// What the "create event" form edits; everything is the raw input text.
export interface CreateEventForm {
  title: string;
  exchangeOn: string;
  organizerName: string;
  organizerEmail: string;
  // Major units as typed, e.g. "150" or "99,99"; empty for no budget.
  budget: string;
  budgetCurrency: string;
  description: string;
  rules: string;
}

export const emptyCreateEventForm = (): CreateEventForm => ({
  title: '',
  exchangeOn: '',
  organizerName: '',
  organizerEmail: '',
  budget: '',
  budgetCurrency: 'PLN',
  description: '',
  rules: '',
});

// The browser's IANA timezone: the event's dates are interpreted in it.
export const browserTimezone = (): string => {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE
    );
  } catch {
    return FALLBACK_TIMEZONE;
  }
};

// "150" → 15000, "99,99" → 9999; null when it is not a non-negative amount
// with at most two decimals.
export const budgetToMinorUnits = (budget: string): number | null => {
  const normalized = budget.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = '0', fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
};

// Today in the given timezone as YYYY-MM-DD (the earliest exchange date).
export const todayIn = (timezone: string, now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

const optional = (text: string): string | undefined =>
  text.trim() === '' ? undefined : text.trim();

export const toCreateEventInput = (
  form: CreateEventForm,
  timezone: string,
): CreateEventInput => {
  const budgetAmount = optional(form.budget)
    ? budgetToMinorUnits(form.budget)
    : null;
  return {
    title: form.title.trim(),
    exchangeOn: form.exchangeOn,
    timezone,
    organizerName: form.organizerName.trim(),
    organizerEmail: form.organizerEmail.trim(),
    description: optional(form.description),
    rules: optional(form.rules),
    ...(budgetAmount === null
      ? {}
      : { budgetAmount, budgetCurrency: form.budgetCurrency }),
  };
};
