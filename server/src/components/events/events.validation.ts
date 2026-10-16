import Joi from 'joi';

import { ValidationSchema } from '@core/interfaces/validationSchema';
import { isCalendarDate, isValidTimezone } from '@shared/dates';
import { emailSchema } from '@components/auth/access.validation';

// Optional free text: empty or blank is stored as null.
const optionalText = (max: number) =>
  Joi.string().trim().max(max).allow('', null).empty('').default(null);

const timezone = Joi.string().custom((value: string, helpers) =>
  isValidTimezone(value) ? value : helpers.error('any.invalid'),
);

const calendarDate = Joi.string().custom((value: string, helpers) =>
  isCalendarDate(value) ? value : helpers.error('any.invalid'),
);

// eslint-disable-next-line import/prefer-default-export -- one schema per event endpoint.
export const createEventSchema: ValidationSchema = {
  body: Joi.object()
    .keys({
      title: Joi.string().trim().min(1).max(200).required(),
      description: optionalText(5000),
      // Minor units, e.g. 15000 = 150.00 PLN.
      budgetAmount: Joi.number().integer().min(0),
      // ISO 4217, e.g. PLN.
      budgetCurrency: Joi.string()
        .uppercase()
        .pattern(/^[A-Z]{3}$/),
      rules: optionalText(5000),
      timezone: timezone.required(),
      exchangeOn: calendarDate.required(),
      organizerName: Joi.string().trim().min(1).max(100).required(),
      organizerEmail: emailSchema.required(),
    })
    // A budget needs both an amount and a currency.
    .and('budgetAmount', 'budgetCurrency'),
};
