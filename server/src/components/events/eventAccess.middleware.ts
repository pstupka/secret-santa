import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { EventRow, ParticipantRow } from '@db/schema';
import { currentPerson } from '@components/auth/authenticate.middleware';
import { AppDeps } from '../../deps';
import { EventStatus, eventStatus } from './events.service';

// The event from `:eventId` and the caller's participant in it.
export interface EventAccess {
  event: EventRow;
  participant: ParticipantRow;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line no-shadow -- augments Express's Request.
  interface Request {
    // Set by `loadEventAccess`.
    eventAccess?: EventAccess;
  }
}

// Resolves `req.eventAccess` for `:eventId`; use behind `authenticate`.
// Unknown events and events the caller does not participate in get the same
// `404`, so non-participants cannot learn that an event exists.
export const loadEventAccess =
  ({ db }: AppDeps) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const person = currentPerson(req);
    const eventId = req.params.eventId as string;

    const event = await db
      .selectFrom('events')
      .selectAll()
      .where('id', '=', eventId)
      .executeTakeFirst();
    const participant =
      event &&
      (await db
        .selectFrom('participants')
        .selectAll()
        .where('event_id', '=', event.id)
        .where('person_id', '=', person.id)
        .executeTakeFirst());
    if (!event || !participant) {
      throw new AppError(httpStatus.NOT_FOUND, 'Event not found');
    }

    req.eventAccess = { event, participant };
    return next();
  };

// The event and the caller's participant; only valid behind `loadEventAccess`.
export const currentEventAccess = (req: Request): EventAccess => {
  if (!req.eventAccess) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Route is missing the loadEventAccess middleware',
      false,
    );
  }
  return req.eventAccess;
};

// `403` unless the caller is the event's organizer.
export const requireOrganizer = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (currentEventAccess(req).participant.role !== 'organizer') {
    throw new AppError(httpStatus.FORBIDDEN, 'Only the organizer can do this');
  }
  return next();
};

// `409` unless the event's (derived) status is one of `allowed`. Every
// mutating endpoint allows at most 'open' and 'drawn': a finished event is
// read-only.
export const requireEventStatus =
  ({ clock }: AppDeps, ...allowed: Exclude<EventStatus, 'finished'>[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const status = eventStatus(currentEventAccess(req).event, clock);
    if (!(allowed as EventStatus[]).includes(status)) {
      throw new AppError(
        httpStatus.CONFLICT,
        `Not allowed while the event is ${status}`,
      );
    }
    return next();
  };
