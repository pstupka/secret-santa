import { Router } from 'express';

import validate from '@core/middlewares/validate.middleware';
import authenticate from '@components/auth/authenticate.middleware';
import {
  actAsManagedParticipant,
  loadEventAccess,
  requireEventStatus,
  requireOrganizer,
} from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import createParticipantsController from './participants.controller';
import addParticipantSchema from './participants.validation';

const createParticipantsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createParticipantsController(deps);
  const participant = [authenticate(deps), loadEventAccess(deps)];
  // Membership is locked once the event is drawn.
  const organizerMembership = [
    ...participant,
    requireOrganizer,
    requireEventStatus(deps, 'open'),
  ];
  // The caller's own participation, or a managed participant's (X-Acting-As).
  const participation = [
    ...participant,
    actAsManagedParticipant(deps),
    requireEventStatus(deps, 'open'),
  ];

  router.post(
    '/events/:eventId/participants',
    ...organizerMembership,
    validate(addParticipantSchema),
    controller.add,
  );
  router.get('/events/:eventId/participants', ...participant, controller.list);
  router.delete(
    '/events/:eventId/participants/:participantId',
    ...organizerMembership,
    controller.remove,
  );
  router.post(
    '/events/:eventId/participation/decline',
    ...participation,
    controller.decline,
  );
  router.post(
    '/events/:eventId/participation/rejoin',
    ...participation,
    controller.rejoin,
  );

  return router;
};

export default createParticipantsRouter;
