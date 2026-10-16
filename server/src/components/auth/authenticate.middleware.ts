import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { nowUtc } from '@shared/clock';
import { AppDeps } from '../../deps';
import { hashMagicToken } from './magicToken';

// The person a valid magic token identifies.
export interface AuthenticatedPerson {
  id: string;
  email: string;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line no-shadow -- augments Express's Request.
  interface Request {
    // Set by `authenticate`.
    person?: AuthenticatedPerson;
  }
}

const BEARER = /^Bearer\s+(\S+)$/i;

// Resolves `req.person` from `Authorization: Bearer <magic token>`. Unknown,
// expired and revoked tokens get the same `401`. The raw token is never logged.
const authenticate =
  ({ db, clock }: AppDeps) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = BEARER.exec(req.header('authorization') ?? '')?.[1];
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    const now = nowUtc(clock);
    const found = await db
      .selectFrom('access_tokens')
      .innerJoin('persons', 'persons.id', 'access_tokens.person_id')
      .select([
        'access_tokens.id as tokenId',
        'persons.id as personId',
        'persons.email',
      ])
      .where('access_tokens.token_hash', '=', hashMagicToken(token))
      .where('access_tokens.revoked_at', 'is', null)
      .where('access_tokens.expires_at', '>', now)
      .executeTakeFirst();
    if (!found) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Unauthorized');
    }

    await db
      .updateTable('access_tokens')
      .set({ last_used_at: now })
      .where('id', '=', found.tokenId)
      .execute();

    req.person = { id: found.personId, email: found.email };
    return next();
  };

// The authenticated person; only valid behind `authenticate`.
export const currentPerson = (req: Request): AuthenticatedPerson => {
  if (!req.person) {
    throw new AppError(
      httpStatus.INTERNAL_SERVER_ERROR,
      'Route is missing the authenticate middleware',
      false,
    );
  }
  return req.person;
};

export default authenticate;
