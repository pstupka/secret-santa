import { Router } from 'express';

import validate from '@core/middlewares/validate.middleware';
import authenticate from '@components/auth/authenticate.middleware';
import {
  actAsManagedParticipant,
  loadEventAccess,
  requireEventStatus,
} from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import createWishlistsController from './wishlists.controller';
import {
  createWishlistSchema,
  updateWishlistSchema,
} from './wishlists.validation';

const createWishlistsRouter = (deps: AppDeps): Router => {
  const router: Router = Router();
  const controller = createWishlistsController(deps);
  // The caller, or a managed participant their caretaker acts as.
  const participant = [
    authenticate(deps),
    loadEventAccess(deps),
    actAsManagedParticipant(deps),
  ];
  // Wishlists can change until the exchange date, also after the draw.
  const editing = [...participant, requireEventStatus(deps, 'open', 'drawn')];

  router.get('/events/:eventId/wishlists', ...participant, controller.list);
  router.post(
    '/events/:eventId/wishlists',
    ...editing,
    validate(createWishlistSchema),
    controller.create,
  );
  router.patch(
    '/events/:eventId/wishlists/:wishlistId',
    ...editing,
    validate(updateWishlistSchema),
    controller.update,
  );
  router.delete(
    '/events/:eventId/wishlists/:wishlistId',
    ...editing,
    controller.remove,
  );

  return router;
};

export default createWishlistsRouter;
