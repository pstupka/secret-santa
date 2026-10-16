import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { currentEventAccess } from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import {
  createWishlist,
  CreateWishlistInput,
  deleteWishlist,
  listVisibleWishlists,
  updateWishlist,
  UpdateWishlistInput,
} from './wishlists.service';

// Every handler acts as the effective participant: the caller, or the
// managed participant a caretaker acts as (X-Acting-As).
const createWishlistsController = ({ db, clock }: AppDeps) => ({
  // GET /events/:eventId/wishlists: my own wishlist and all child wishlists
  // (with claim info, except on my children's).
  list: async (req: Request, res: Response) => {
    const { participant, caretaker } = currentEventAccess(req);
    res
      .status(httpStatus.OK)
      .json(await listVisibleWishlists(db, participant, caretaker));
  },

  // POST /events/:eventId/wishlists: my own wishlist or a child wishlist.
  create: async (req: Request, res: Response) => {
    const { participant } = currentEventAccess(req);
    const wishlist = await createWishlist(
      db,
      clock,
      participant,
      req.body as CreateWishlistInput,
    );
    res.status(httpStatus.CREATED).json(wishlist);
  },

  // PATCH /events/:eventId/wishlists/:wishlistId (owner).
  update: async (req: Request, res: Response) => {
    const { participant } = currentEventAccess(req);
    const wishlist = await updateWishlist(
      db,
      clock,
      participant,
      req.params.wishlistId as string,
      req.body as UpdateWishlistInput,
    );
    res.status(httpStatus.OK).json(wishlist);
  },

  // DELETE /events/:eventId/wishlists/:wishlistId (owner).
  remove: async (req: Request, res: Response) => {
    const { participant } = currentEventAccess(req);
    await deleteWishlist(db, participant, req.params.wishlistId as string);
    res.status(httpStatus.NO_CONTENT).end();
  },
});

export default createWishlistsController;
