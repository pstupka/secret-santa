import { Request, Response } from 'express';
import httpStatus from 'http-status';

import { enqueueEmail } from '@email/outbox';
import { findPersonByEmail } from '@components/persons/persons';
import { AppDeps } from '../../deps';
import { currentPerson } from './authenticate.middleware';
import { issueMagicToken } from './magicToken';

// Same body whether or not the email belongs to a person, so the endpoint
// does not reveal who uses the app.
export const ACCESS_LINK_RESPONSE = {
  message: 'If this email is known, a personal link has been sent to it.',
};

const createAccessController = ({ db, clock }: AppDeps) => ({
  // POST /access-links: email an additional personal link to a known person.
  requestAccessLink: async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };
    await db.transaction().execute(async (trx) => {
      const person = await findPersonByEmail(trx, email);
      if (!person) return;
      const token = await issueMagicToken(trx, clock, person.id);
      await enqueueEmail(trx, clock, {
        to: person.email,
        template: 'access-link',
        payload: { token },
      });
    });
    res.status(httpStatus.ACCEPTED).json(ACCESS_LINK_RESPONSE);
  },

  // GET /me: lets the client validate a stored magic token.
  me: (req: Request, res: Response) => {
    const { id, email } = currentPerson(req);
    res.status(httpStatus.OK).json({ id, email });
  },
});

export default createAccessController;
