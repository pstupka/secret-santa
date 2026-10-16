import { Db } from '@db/database';
import { EmailTemplate } from '@db/schema';
import { Clock, nowUtc } from '@shared/clock';
import newId from '@shared/ids';
import { EmailPayloads } from './templates';

export interface OutgoingEmail<T extends EmailTemplate> {
  to: string;
  template: T;
  payload: EmailPayloads[T];
}

// Queues an email in the caller's transaction (ADR-0002): it is sent only if
// that transaction commits. Returns the outbox row id.
export const enqueueEmail = async <T extends EmailTemplate>(
  trx: Db,
  clock: Clock,
  { to, template, payload }: OutgoingEmail<T>,
): Promise<string> => {
  const id = newId();
  await trx
    .insertInto('email_outbox')
    .values({
      id,
      to_email: to,
      template,
      payload: JSON.stringify(payload),
      send_after: nowUtc(clock),
    })
    .execute();
  return id;
};
