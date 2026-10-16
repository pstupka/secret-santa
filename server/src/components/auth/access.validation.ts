import Joi from 'joi';

import { ValidationSchema } from '@core/interfaces/validationSchema';

export const emailSchema = Joi.string().trim().lowercase().email().max(254);

export const requestAccessLinkSchema: ValidationSchema = {
  body: Joi.object().keys({
    email: emailSchema.required(),
  }),
};
