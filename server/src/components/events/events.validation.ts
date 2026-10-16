import Joi from 'joi';

import { ValidationSchema } from '@core/interfaces/validationSchema';
import { isCalendarDate, isValidTimezone } from '@shared/dates';
import { emailSchema } from '@components/auth/access.validation';

// Optional free text: empty or blank is stored as null.
const optionalText = (max: number) =>
  Joi.string().trim().max(max).allow('', null).empty('').default(null);

const title = Joi.string().trim().min(1).max(200);

// Minor units, e.g. 15000 = 150.00 PLN.
const budgetAmount = Joi.number().integer().min(0);

// ISO 4217, e.g. PLN.
const budgetCurrency = Joi.string()
  .uppercase()
  .pattern(/^[A-Z]{3}$/);

const timezone = Joi.string().custom((value: string, helpers) =>
  isValidTimezone(value) ? value : helpers.error('any.invalid'),
);

const calendarDate = Joi.string().custom((value: string, helpers) =>
  isCalendarDate(value) ? value : helpers.error('any.invalid'),
);

export const createEventSchema: ValidationSchema = {
  body: Joi.object()
    .keys({
      title: title.required(),
      description: optionalText(5000),
      budgetAmount,
      budgetCurrency,
      rules: optionalText(5000),
      timezone: timezone.required(),
      exchangeOn: calendarDate.required(),
      organizerName: Joi.string().trim().min(1).max(100).required(),
      organizerEmail: emailSchema.required(),
    })
    // A budget needs both an amount and a currency.
    .and('budgetAmount', 'budgetCurrency'),
};

// Nullable free text in a partial update: absent stays unchanged; empty or
// blank is cleared to null by `updateEventSchema`.
const clearableText = (max: number) =>
  Joi.string().trim().max(max).allow('', null);

const CLEARABLE_TEXT_KEYS = ['description', 'rules'];

// Partial update: only the given fields change. The budget is set or cleared
// (both null) as a pair.
export const updateEventSchema: ValidationSchema = {
  body: Joi.object()
    .keys({
      title,
      description: clearableText(5000),
      budgetAmount: budgetAmount.allow(null),
      budgetCurrency: budgetCurrency.allow(null),
      rules: clearableText(5000),
      timezone,
      exchangeOn: calendarDate,
    })
    .min(1)
    .and('budgetAmount', 'budgetCurrency')
    .custom((body: Record<string, unknown>, helpers) => {
      if ((body.budgetAmount === null) !== (body.budgetCurrency === null)) {
        return helpers.error('object.budget');
      }
      return Object.fromEntries(
        Object.entries(body).map(([key, value]) => [
          key,
          CLEARABLE_TEXT_KEYS.includes(key) && value === '' ? null : value,
        ]),
      );
    })
    .messages({
      'object.budget':
        '"budgetAmount" and "budgetCurrency" must be cleared together',
    }),
};
