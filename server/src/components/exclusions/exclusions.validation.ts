import Joi from 'joi';

import { ValidationSchema } from '@core/interfaces/validationSchema';

const participantId = Joi.string().trim().min(1).max(64).required();

// Two participants of the event, in either order.
const addExclusionSchema: ValidationSchema = {
  body: Joi.object().keys({
    participantAId: participantId,
    participantBId: participantId,
  }),
};

export default addExclusionSchema;
