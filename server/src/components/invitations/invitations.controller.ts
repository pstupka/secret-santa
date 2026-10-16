import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { currentEventAccess } from '@components/events/eventAccess.middleware';
import { AppDeps } from '../../deps';
import { sendInvitation, sendPendingInvitations } from './invitations.service';

const createInvitationsController = ({ db, clock }: AppDeps) => ({
  // POST /events/:eventId/invitations/send (organizer): everyone not invited yet.
  sendPending: async (req: Request, res: Response) => {
    const sent = await sendPendingInvitations(
      db,
      clock,
      currentEventAccess(req).event,
    );
    res.status(httpStatus.OK).json({ sent });
  },

  // POST /events/:eventId/participants/:participantId/invitation (organizer):
  // send or resend to one participant.
  send: async (req: Request, res: Response) => {
    const invitation = await sendInvitation(
      db,
      clock,
      currentEventAccess(req).event,
      req.params.participantId as string,
    );
    res.status(httpStatus.OK).json(invitation);
  },
});

export default createInvitationsController;
