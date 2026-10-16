import { Router } from 'express';

import validate from '@core/middlewares/validate.middleware';
import {
  limitPublicByEmail,
  limitPublicByIp,
} from '@core/middlewares/rateLimit.middleware';
import { AppDeps } from '../../deps';
import createEventsController from './events.controller';
import { createEventSchema } from './events.validation';

const createEventsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createEventsController(deps);

  router.post(
    '/events',
    limitPublicByIp(deps.clock),
    validate(createEventSchema),
    limitPublicByEmail(deps.clock, 'organizerEmail'),
    controller.create,
  );

  return router;
};

export default createEventsRouter;
