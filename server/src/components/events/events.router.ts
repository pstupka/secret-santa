import { Router } from 'express';

import validate from '@core/middlewares/validate.middleware';
import {
  limitPublicByEmail,
  limitPublicByIp,
} from '@core/middlewares/rateLimit.middleware';
import authenticate from '@components/auth/authenticate.middleware';
import { AppDeps } from '../../deps';
import createEventsController from './events.controller';
import { createEventSchema, updateEventSchema } from './events.validation';
import {
  loadEventAccess,
  requireEventStatus,
  requireOrganizer,
} from './eventAccess.middleware';

const createEventsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createEventsController(deps);
  const participant = [authenticate(deps), loadEventAccess(deps)];
  // Organizer-only changes to an event that is not finished.
  const organizerEdit = [
    ...participant,
    requireOrganizer,
    requireEventStatus(deps, 'open', 'drawn'),
  ];

  router.post(
    '/events',
    limitPublicByIp(deps.clock),
    validate(createEventSchema),
    limitPublicByEmail(deps.clock, 'organizerEmail'),
    controller.create,
  );
  router.get('/events', authenticate(deps), controller.list);
  router.get('/events/:eventId', ...participant, controller.get);
  router.patch(
    '/events/:eventId',
    ...organizerEdit,
    validate(updateEventSchema),
    controller.update,
  );
  router.delete('/events/:eventId', ...organizerEdit, controller.remove);

  return router;
};

export default createEventsRouter;
