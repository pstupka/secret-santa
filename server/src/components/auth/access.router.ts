import { Router } from 'express';

import validate from '@core/middlewares/validate.middleware';
import {
  limitPublicByEmail,
  limitPublicByIp,
} from '@core/middlewares/rateLimit.middleware';
import { AppDeps } from '../../deps';
import createAccessController from './access.controller';
import { requestAccessLinkSchema } from './access.validation';
import authenticate from './authenticate.middleware';

const createAccessRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createAccessController(deps);

  router.post(
    '/access-links',
    limitPublicByIp(deps.clock),
    validate(requestAccessLinkSchema),
    limitPublicByEmail(deps.clock, 'email'),
    controller.requestAccessLink,
  );
  router.get('/me', authenticate(deps), controller.me);

  return router;
};

export default createAccessRouter;
