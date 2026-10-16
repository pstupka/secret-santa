import { Router } from 'express';

import healthCheck from '@components/healthcheck/healthCheck.router';
import createAccessRouter from '@components/auth/access.router';
import createEventsRouter from '@components/events/events.router';
import createParticipantsRouter from '@components/participants/participants.router';
import createInvitationsRouter from '@components/invitations/invitations.router';
import createExclusionsRouter from '@components/exclusions/exclusions.router';
import { AppDeps } from './deps';

const createApi = (deps: AppDeps): Router => {
  const router: Router = Router();
  router.use(healthCheck);
  router.use(createAccessRouter(deps));
  router.use(createEventsRouter(deps));
  router.use(createParticipantsRouter(deps));
  router.use(createInvitationsRouter(deps));
  router.use(createExclusionsRouter(deps));
  return router;
};

export default createApi;
