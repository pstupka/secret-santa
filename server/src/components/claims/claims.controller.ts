import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { currentEventAccess } from '@components/events/eventAccess.middleware';
import { claimReaderOf } from '@components/wishlists/wishlists.service';
import { AppDeps } from '../../deps';
import {
  claimWishlistItem,
  listMyClaims,
  releaseClaim,
} from './claims.service';

// Every handler acts as the effective participant: the caller, or the
// managed participant a caretaker acts as (X-Acting-As).
const createClaimsController = ({ db, clock }: AppDeps) => ({
  // PUT /events/:eventId/wishlist-items/:itemId/claim (not the child's parent).
  claim: async (req: Request, res: Response) => {
    const { event, participant, caretaker } = currentEventAccess(req);
    const claim = await claimWishlistItem(
      db,
      clock,
      await claimReaderOf(db, participant, caretaker),
      event.id,
      req.params.itemId as string,
    );
    res.status(httpStatus.OK).json(claim);
  },

  // DELETE /events/:eventId/wishlist-items/:itemId/claim (the claimer).
  release: async (req: Request, res: Response) => {
    const { event, participant, caretaker } = currentEventAccess(req);
    await releaseClaim(
      db,
      await claimReaderOf(db, participant, caretaker),
      event.id,
      req.params.itemId as string,
    );
    res.status(httpStatus.NO_CONTENT).end();
  },

  // GET /events/:eventId/my-claims: my shopping list.
  listMine: async (req: Request, res: Response) => {
    const { participant } = currentEventAccess(req);
    res.status(httpStatus.OK).json(await listMyClaims(db, participant.id));
  },
});

export default createClaimsController;
