import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import { EventRow } from '@db/schema';
import { enqueueEmail } from '@email/outbox';
import { Clock, nowUtc } from '@shared/clock';
import { issueMagicToken } from '@components/auth/magicToken';

// Sending invitations (ADR-0003): a deliberate organizer action, never a side
// effect of adding a participant. Each invitation carries a fresh personal
// link: a new magic token is issued in the same transaction that enqueues the
// email and records `invite_sent_at`.

export interface InvitationSentDto {
  participantId: string;
  inviteSentAt: string;
}

// A participant who can receive an invitation, with their email.
interface Invitee {
  id: string;
  person_id: string;
  display_name: string;
  email: string;
}

// Non-managed participants of the event with their emails.
const inviteesOf = (trx: Db, eventId: string) =>
  trx
    .selectFrom('participants')
    .innerJoin('persons', 'persons.id', 'participants.person_id')
    .select([
      'participants.id',
      'participants.person_id',
      'participants.display_name',
      'persons.email',
    ])
    .where('participants.event_id', '=', eventId)
    .$narrowType<{ person_id: string }>();

const organizerNameOf = async (trx: Db, eventId: string): Promise<string> => {
  const organizer = await trx
    .selectFrom('participants')
    .select('display_name')
    .where('event_id', '=', eventId)
    .where('role', '=', 'organizer')
    .executeTakeFirstOrThrow();
  return organizer.display_name;
};

// Issues a new magic token, enqueues the invitation and records when it was
// sent. Runs in the caller's transaction.
const invite = async (
  trx: Db,
  clock: Clock,
  event: EventRow,
  organizerName: string,
  invitee: Invitee,
): Promise<InvitationSentDto> => {
  const token = await issueMagicToken(trx, clock, invitee.person_id);
  await enqueueEmail(trx, clock, {
    to: invitee.email,
    template: 'invitation',
    payload: {
      token,
      participantName: invitee.display_name,
      organizerName,
      eventTitle: event.title,
      description: event.description,
      exchangeOn: event.exchange_on,
      budget:
        event.budget_amount !== null && event.budget_currency !== null
          ? { amount: event.budget_amount, currency: event.budget_currency }
          : null,
      rules: event.rules,
    },
  });

  const inviteSentAt = nowUtc(clock);
  await trx
    .updateTable('participants')
    .set({ invite_sent_at: inviteSentAt })
    .where('id', '=', invitee.id)
    .execute();
  return { participantId: invitee.id, inviteSentAt };
};

// Bulk: invites every non-managed participant not invited yet (the organizer
// already is), in one transaction. Never re-sends; returns how many were sent.
export const sendPendingInvitations = (
  db: Db,
  clock: Clock,
  event: EventRow,
): Promise<number> =>
  db.transaction().execute(async (trx) => {
    const invitees = await inviteesOf(trx, event.id)
      .where('participants.invite_sent_at', 'is', null)
      .where('participants.role', '<>', 'organizer')
      .orderBy('participants.added_at')
      .orderBy('participants.id')
      .execute();
    if (invitees.length === 0) return 0;

    const organizerName = await organizerNameOf(trx, event.id);
    // Sequential: one SQLite transaction runs one statement at a time anyway.
    // eslint-disable-next-line no-restricted-syntax
    for (const invitee of invitees) {
      // eslint-disable-next-line no-await-in-loop
      await invite(trx, clock, event, organizerName, invitee);
    }
    return invitees.length;
  });

// Sends the invitation to one participant, or resends it with a new personal
// link. Managed participants never receive emails (`422`).
export const sendInvitation = (
  db: Db,
  clock: Clock,
  event: EventRow,
  participantId: string,
): Promise<InvitationSentDto> =>
  db.transaction().execute(async (trx) => {
    const participant = await trx
      .selectFrom('participants')
      .select('person_id')
      .where('id', '=', participantId)
      .where('event_id', '=', event.id)
      .executeTakeFirst();
    if (!participant) {
      throw new AppError(httpStatus.NOT_FOUND, 'Participant not found');
    }
    if (participant.person_id === null) {
      throw new AppError(
        httpStatus.UNPROCESSABLE_ENTITY,
        'A managed participant cannot be invited',
      );
    }

    const invitee = await inviteesOf(trx, event.id)
      .where('participants.id', '=', participantId)
      .executeTakeFirstOrThrow();
    const organizerName = await organizerNameOf(trx, event.id);
    return invite(trx, clock, event, organizerName, invitee);
  });
