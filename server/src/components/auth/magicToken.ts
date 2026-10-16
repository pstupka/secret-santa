import { createHash, randomBytes } from 'node:crypto';

import { Db } from '@db/database';
import { Clock, toUtcTimestamp } from '@shared/clock';
import newId from '@shared/ids';

// Magic tokens (ADR-0001): 32 random bytes, base64url. Only the SHA-256 hash
// is stored; the raw token exists only in the outbox payload until sent.

const TOKEN_BYTES = 32;
const TOKEN_LIFETIME_YEARS = 1;

export const hashMagicToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

// Issues an additional magic token for the person in the caller's transaction
// and returns the raw token. Existing tokens keep working.
export const issueMagicToken = async (
  trx: Db,
  clock: Clock,
  personId: string,
): Promise<string> => {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const createdAt = clock.now();
  const expiresAt = new Date(createdAt.getTime());
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + TOKEN_LIFETIME_YEARS);

  await trx
    .insertInto('access_tokens')
    .values({
      id: newId(),
      person_id: personId,
      token_hash: hashMagicToken(token),
      created_at: toUtcTimestamp(createdAt),
      expires_at: toUtcTimestamp(expiresAt),
    })
    .execute();
  return token;
};
