import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { currentEventAccess } from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import {
  addExclusion,
  listExclusions,
  removeExclusion,
} from './exclusions.service';

const createExclusionsController = ({ db }: AppDeps) => ({
  // GET /events/:eventId/exclusions (organizer): stored and built-in pairs.
  list: async (req: Request, res: Response) => {
    res
      .status(httpStatus.OK)
      .json(await listExclusions(db, currentEventAccess(req).event.id));
  },

  // POST /events/:eventId/exclusions (organizer).
  add: async (req: Request, res: Response) => {
    const { participantAId, participantBId } = req.body as {
      participantAId: string;
      participantBId: string;
    };
    const exclusion = await addExclusion(
      db,
      currentEventAccess(req).event.id,
      participantAId,
      participantBId,
    );
    res.status(httpStatus.CREATED).json(exclusion);
  },

  // DELETE /events/:eventId/exclusions/:aId/:bId (organizer), either order.
  remove: async (req: Request, res: Response) => {
    await removeExclusion(
      db,
      currentEventAccess(req).event.id,
      req.params.aId as string,
      req.params.bId as string,
    );
    res.status(httpStatus.NO_CONTENT).end();
  },
});

export default createExclusionsController;
