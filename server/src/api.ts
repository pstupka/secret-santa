import { Router } from 'express';

import healthCheck from '@components/healthcheck/healthCheck.router';
import { AppDeps } from './deps';

const createApi = (_deps: AppDeps): Router => {
  const router: Router = Router();
  router.use(healthCheck);
  return router;
};

export default createApi;
