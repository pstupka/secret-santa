import { Router } from 'express';

import healthCheck from '@components/healthcheck/healthCheck.router';
import createAccessRouter from '@components/auth/access.router';
import createEventsRouter from '@components/events/events.router';
import { AppDeps } from './deps';

const createApi = (deps: AppDeps): Router => {
  const router: Router = Router();
  router.use(healthCheck);
  router.use(createAccessRouter(deps));
  router.use(createEventsRouter(deps));
  return router;
};

export default createApi;
