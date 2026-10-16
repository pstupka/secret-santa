import { Db } from '@db/database';
import { PersonRow } from '@db/schema';
import { Clock, nowUtc } from '@shared/clock';
import newId from '@shared/ids';

// Emails compare case-insensitively (the column is COLLATE NOCASE).
export const findPersonByEmail = (
  db: Db,
  email: string,
): Promise<PersonRow | undefined> =>
  db
    .selectFrom('persons')
    .selectAll()
    .where('email', '=', email)
    .executeTakeFirst();

// Returns the person with this email, creating them if needed.
export const findOrCreatePerson = async (
  trx: Db,
  clock: Clock,
  email: string,
): Promise<PersonRow> => {
  const existing = await findPersonByEmail(trx, email);
  if (existing) return existing;

  const person: PersonRow = { id: newId(), email, created_at: nowUtc(clock) };
  await trx.insertInto('persons').values(person).execute();
  return person;
};
