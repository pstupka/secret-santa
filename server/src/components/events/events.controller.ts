import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { AppDeps } from '../../deps';
import { createEvent, CreateEventInput, toEventDto } from './events.service';

const createEventsController = ({ db, clock }: AppDeps) => ({
  // POST /events (public): `201` with the event; the magic token is emailed only.
  create: async (req: Request, res: Response) => {
    const event = await createEvent(db, clock, req.body as CreateEventInput);
    res.status(httpStatus.CREATED).json(toEventDto(event, clock));
  },
});

export default createEventsController;
