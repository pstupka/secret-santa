import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { currentPerson } from '@components/auth/authenticate.middleware';
import { AppDeps } from '../../deps';
import { currentEventAccess } from './eventAccess.middleware';
import {
  createEvent,
  CreateEventInput,
  deleteEvent,
  getEventDetails,
  listEventsOf,
  toEventDto,
  updateEvent,
  UpdateEventInput,
} from './events.service';

const createEventsController = ({ db, clock }: AppDeps) => ({
  // POST /events (public): `201` with the event; the magic token is emailed only.
  create: async (req: Request, res: Response) => {
    const event = await createEvent(db, clock, req.body as CreateEventInput);
    res.status(httpStatus.CREATED).json(toEventDto(event, clock));
  },

  // GET /events: the caller's events with their own participant in each.
  list: async (req: Request, res: Response) => {
    const events = await listEventsOf(db, clock, currentPerson(req).id);
    res.status(httpStatus.OK).json(events);
  },

  // GET /events/:eventId (participant): details plus participant names and statuses.
  get: async (req: Request, res: Response) => {
    const { event, participant } = currentEventAccess(req);
    res
      .status(httpStatus.OK)
      .json(await getEventDetails(db, clock, event, participant));
  },

  // PATCH /events/:eventId (organizer): partial update of details and dates.
  update: async (req: Request, res: Response) => {
    const { event } = currentEventAccess(req);
    const updated = await updateEvent(
      db,
      clock,
      event,
      req.body as UpdateEventInput,
    );
    res.status(httpStatus.OK).json(toEventDto(updated, clock));
  },

  // DELETE /events/:eventId (organizer): the event and all its data.
  remove: async (req: Request, res: Response) => {
    await deleteEvent(db, currentEventAccess(req).event.id);
    res.status(httpStatus.NO_CONTENT).end();
  },
});

export default createEventsController;
