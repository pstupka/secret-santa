import { Router } from 'express';

import authenticate from '@components/auth/authenticate.middleware';
import {
  loadEventAccess,
  requireEventStatus,
  requireOrganizer,
} from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import createInvitationsController from './invitations.controller';

const createInvitationsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createInvitationsController(deps);
  // Invitations are part of building the membership: locked once drawn.
  const organizerMembership = [
    authenticate(deps),
    loadEventAccess(deps),
    requireOrganizer,
    requireEventStatus(deps, 'open'),
  ];

  router.post(
    '/events/:eventId/invitations/send',
    ...organizerMembership,
    controller.sendPending,
  );
  router.post(
    '/events/:eventId/participants/:participantId/invitation',
    ...organizerMembership,
    controller.send,
  );

  return router;
};

export default createInvitationsRouter;
