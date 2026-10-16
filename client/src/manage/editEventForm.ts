import type { Event, UpdateEventInput } from '@/api';
import { budgetToMinorUnits } from '@/events/createEventForm';

// What the "edit event" form edits; everything is the raw input text.
export interface EditEventForm {
  title: string;
  exchangeOn: string;
  timezone: string;
  // Major units as typed, e.g. "150" or "99,99"; empty for no budget.
  budget: string;
  budgetCurrency: string;
  description: string;
  rules: string;
}

// 15000 → "150", 9999 → "99,99" (Polish decimal comma).
export const minorUnitsToBudget = (amount: number): string => {
  const whole = Math.floor(amount / 100);
  const fraction = amount % 100;
  return fraction === 0
    ? String(whole)
    : `${whole},${String(fraction).padStart(2, '0')}`;
};

export const editEventFormFrom = (event: Event): EditEventForm => ({
  title: event.title,
  exchangeOn: event.exchangeOn,
  timezone: event.timezone,
  budget:
    event.budgetAmount === null ? '' : minorUnitsToBudget(event.budgetAmount),
  budgetCurrency: event.budgetCurrency ?? 'PLN',
  description: event.description ?? '',
  rules: event.rules ?? '',
});

const clearable = (text: string): string | null =>
  text.trim() === '' ? null : text.trim();

// Only the fields that differ from the event, so an unchanged exchange date
// is never re-validated; empty when nothing changed. Assumes a valid budget.
export const toUpdateEventInput = (
  form: EditEventForm,
  event: Event,
): UpdateEventInput => {
  const input: UpdateEventInput = {};
  const title = form.title.trim();
  if (title !== event.title) input.title = title;
  if (form.exchangeOn !== event.exchangeOn) input.exchangeOn = form.exchangeOn;
  if (form.timezone !== event.timezone) input.timezone = form.timezone;

  const description = clearable(form.description);
  if (description !== event.description) input.description = description;
  const rules = clearable(form.rules);
  if (rules !== event.rules) input.rules = rules;

  const budgetAmount =
    form.budget.trim() === '' ? null : budgetToMinorUnits(form.budget);
  const budgetCurrency = budgetAmount === null ? null : form.budgetCurrency;
  if (
    budgetAmount !== event.budgetAmount ||
    budgetCurrency !== event.budgetCurrency
  ) {
    input.budgetAmount = budgetAmount;
    input.budgetCurrency = budgetCurrency;
  }
  return input;
};

// Every IANA timezone the browser knows, always including `current`.
export const timezoneOptions = (current: string): string[] => {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf('timeZone');
  } catch {
    zones = [];
  }
  return zones.includes(current) ? zones : [current, ...zones];
};
