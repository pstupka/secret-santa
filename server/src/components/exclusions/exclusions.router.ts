import { Router } from 'express';

import validate from '@core/middlewares/validate.middleware';
import authenticate from '@components/auth/authenticate.middleware';
import {
  loadEventAccess,
  requireEventStatus,
  requireOrganizer,
} from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import createExclusionsController from './exclusions.controller';
import addExclusionSchema from './exclusions.validation';

const createExclusionsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createExclusionsController(deps);
  const organizer = [
    authenticate(deps),
    loadEventAccess(deps),
    requireOrganizer,
  ];
  // Exclusions are locked once the event is drawn (ADR-0005).
  const organizerChange = [...organizer, requireEventStatus(deps, 'open')];

  router.get('/events/:eventId/exclusions', ...organizer, controller.list);
  router.post(
    '/events/:eventId/exclusions',
    ...organizerChange,
    validate(addExclusionSchema),
    controller.add,
  );
  router.delete(
    '/events/:eventId/exclusions/:aId/:bId',
    ...organizerChange,
    controller.remove,
  );

  return router;
};

export default createExclusionsRouter;
