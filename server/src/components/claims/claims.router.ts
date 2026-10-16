import { Router } from 'express';

import authenticate from '@components/auth/authenticate.middleware';
import {
  actAsManagedParticipant,
  loadEventAccess,
  requireEventStatus,
} from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import createClaimsController from './claims.controller';

const createClaimsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createClaimsController(deps);
  // The caller, or a managed participant their caretaker acts as.
  const participant = [
    authenticate(deps),
    loadEventAccess(deps),
    actAsManagedParticipant(deps),
  ];
  // Claims can change until the exchange date, also after the draw.
  const claiming = [...participant, requireEventStatus(deps, 'open', 'drawn')];

  router.put(
    '/events/:eventId/wishlist-items/:itemId/claim',
    ...claiming,
    controller.claim,
  );
  router.delete(
    '/events/:eventId/wishlist-items/:itemId/claim',
    ...claiming,
    controller.release,
  );
  router.get('/events/:eventId/my-claims', ...participant, controller.listMine);

  return router;
};

export default createClaimsRouter;
