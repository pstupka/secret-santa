import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { currentEventAccess } from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import { findMyAssignment, runDraw } from './draw.service';

const createDrawController = ({ db, clock }: AppDeps) => ({
  // POST /events/:eventId/draw (organizer): draw or redo; never returns pairs.
  draw: async (req: Request, res: Response) => {
    res
      .status(httpStatus.OK)
      .json(await runDraw(db, clock, currentEventAccess(req).event));
  },

  // GET /events/:eventId/my-assignment: the effective participant's own
  // assignment (a caretaker may ask for their managed participant's).
  myAssignment: async (req: Request, res: Response) => {
    res
      .status(httpStatus.OK)
      .json(await findMyAssignment(db, currentEventAccess(req).participant));
  },
});

export default createDrawController;
