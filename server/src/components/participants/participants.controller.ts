import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { ParticipantStatus } from '@db/schema';
import { currentEventAccess } from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import {
  addParticipant,
  AddParticipantInput,
  listParticipants,
  removeParticipant,
  setParticipation,
  toParticipantSummaryDto,
} from './participants.service';

const createParticipantsController = ({ db, clock }: AppDeps) => {
  // Declines or rejoins as the effective participant: the caller, or the
  // managed participant a caretaker acts as.
  const respond =
    (status: ParticipantStatus) => async (req: Request, res: Response) => {
      const { participant } = currentEventAccess(req);
      const updated = await setParticipation(db, clock, participant, status);
      res.status(httpStatus.OK).json(toParticipantSummaryDto(updated));
    };

  return {
    // POST /events/:eventId/participants (organizer): add silently, no email.
    add: async (req: Request, res: Response) => {
      const participant = await addParticipant(
        db,
        clock,
        currentEventAccess(req).event.id,
        req.body as AddParticipantInput,
      );
      res.status(httpStatus.CREATED).json(participant);
    },

    // GET /events/:eventId/participants (participant): the organizer sees more.
    list: async (req: Request, res: Response) => {
      const { event, participant } = currentEventAccess(req);
      res
        .status(httpStatus.OK)
        .json(await listParticipants(db, event.id, participant));
    },

    // DELETE /events/:eventId/participants/:participantId (organizer).
    remove: async (req: Request, res: Response) => {
      await removeParticipant(
        db,
        currentEventAccess(req).event.id,
        req.params.participantId as string,
      );
      res.status(httpStatus.NO_CONTENT).end();
    },

    // POST /events/:eventId/participation/decline: leave the draw.
    decline: respond('declined'),

    // POST /events/:eventId/participation/rejoin: undo a decline.
    rejoin: respond('active'),
  };
};

export default createParticipantsController;
