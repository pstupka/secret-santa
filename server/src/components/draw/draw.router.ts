import { Router } from 'express';

import authenticate from '@components/auth/authenticate.middleware';
import {
  actAsManagedParticipant,
  loadEventAccess,
  requireEventStatus,
  requireOrganizer,
} from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import createDrawController from './draw.controller';

const createDrawRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createDrawController(deps);

  // Draw from 'open', redo from 'drawn' (ADR-0005).
  router.post(
    '/events/:eventId/draw',
    authenticate(deps),
    loadEventAccess(deps),
    requireOrganizer,
    requireEventStatus(deps, 'open', 'drawn'),
    controller.draw,
  );
  // Readable also once the event is finished.
  router.get(
    '/events/:eventId/my-assignment',
    authenticate(deps),
    loadEventAccess(deps),
    actAsManagedParticipant(deps),
    controller.myAssignment,
  );

  return router;
};

export default createDrawRouter;
