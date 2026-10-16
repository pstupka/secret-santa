import Joi from 'joi';

import { ValidationSchema } from '@core/interfaces/validationSchema';
import { emailSchema } from '@components/auth/access.validation';

// Either a participant with an email (the person is found or created) or a
// managed participant without one, looked after by a caretaker.
const addParticipantSchema: ValidationSchema = {
  body: Joi.object()
    .keys({
      displayName: Joi.string().trim().min(1).max(100).required(),
      email: emailSchema,
      managedByParticipantId: Joi.string().trim().min(1).max(64),
    })
    .xor('email', 'managedByParticipantId'),
};

export default addParticipantSchema;
