import httpStatus from 'http-status';
import { sql } from 'kysely';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import { ParticipantRole, ParticipantRow, ParticipantStatus } from '@db/schema';
import { Clock, nowUtc } from '@shared/clock';
import newId from '@shared/ids';
import { findOrCreatePerson } from '@components/persons/persons';

// PLAN.md rate limits: an event holds at most this many participants.
export const MAX_PARTICIPANTS_PER_EVENT = 50;

// What every participant may see about the others: names and statuses.
export interface ParticipantSummaryDto {
  id: string;
  displayName: string;
  role: ParticipantRole;
  status: ParticipantStatus;
}

// The organizer's view of a participant.
export interface OrganizerParticipantDto extends ParticipantSummaryDto {
  // null for a managed participant.
  email: string | null;
  // The caretaker of a managed participant, otherwise null.
  managedByParticipantId: string | null;
  inviteSentAt: string | null;
  firstOpenedAt: string | null;
  // Whether the participant's own wishlist has items or notes; nothing else
  // about the wishlist is shown to the organizer.
  wishlistFilled: boolean;
}

export const toParticipantSummaryDto = (
  participant: Pick<ParticipantRow, 'id' | 'display_name' | 'role' | 'status'>,
): ParticipantSummaryDto => ({
  id: participant.id,
  displayName: participant.display_name,
  role: participant.role,
  status: participant.status,
});

// Every participant of the event with the organizer-only fields, in the
// order they were added.
const listParticipantsForOrganizer = async (
  db: Db,
  eventId: string,
): Promise<OrganizerParticipantDto[]> => {
  const rows = await db
    .selectFrom('participants')
    .leftJoin('persons', 'persons.id', 'participants.person_id')
    .selectAll('participants')
    .select((eb) => [
      'persons.email',
      eb
        .exists(
          eb
            .selectFrom('wishlists')
            .select(sql.lit(1).as('one'))
            .whereRef('wishlists.participant_id', '=', 'participants.id')
            .where('wishlists.child_name', 'is', null)
            .where((wishlist) =>
              wishlist.or([
                wishlist(sql`trim(wishlists.notes)`, '<>', ''),
                wishlist.exists(
                  wishlist
                    .selectFrom('wishlist_items')
                    .select(sql.lit(1).as('one'))
                    .whereRef(
                      'wishlist_items.wishlist_id',
                      '=',
                      'wishlists.id',
                    ),
                ),
              ]),
            ),
        )
        .as('wishlistFilled'),
    ])
    .where('participants.event_id', '=', eventId)
    .orderBy('participants.added_at')
    .orderBy('participants.id')
    .execute();

  return rows.map((row) => ({
    ...toParticipantSummaryDto(row),
    email: row.email,
    managedByParticipantId: row.managed_by_participant_id,
    inviteSentAt: row.invite_sent_at,
    firstOpenedAt: row.first_opened_at,
    wishlistFilled: Boolean(row.wishlistFilled),
  }));
};

// Participant names and statuses, in the order they were added.
export const listParticipantSummaries = async (
  db: Db,
  eventId: string,
): Promise<ParticipantSummaryDto[]> => {
  const rows = await db
    .selectFrom('participants')
    .select(['id', 'display_name', 'role', 'status'])
    .where('event_id', '=', eventId)
    .orderBy('added_at')
    .orderBy('id')
    .execute();
  return rows.map(toParticipantSummaryDto);
};

// The organizer sees emails, invitation state, caretakers and whether
// wishlists are filled; everyone else only names and statuses.
export const listParticipants = (
  db: Db,
  eventId: string,
  viewer: ParticipantRow,
): Promise<ParticipantSummaryDto[] | OrganizerParticipantDto[]> =>
  viewer.role === 'organizer'
    ? listParticipantsForOrganizer(db, eventId)
    : listParticipantSummaries(db, eventId);

// The managed participants a caretaker can act as (`X-Acting-As`).
export const listManagedParticipantsOf = async (
  db: Db,
  caretaker: ParticipantRow,
): Promise<ParticipantSummaryDto[]> => {
  const rows = await db
    .selectFrom('participants')
    .select(['id', 'display_name', 'role', 'status'])
    .where('managed_by_participant_id', '=', caretaker.id)
    .orderBy('added_at')
    .orderBy('id')
    .execute();
  return rows.map(toParticipantSummaryDto);
};

// A participant with an email, or a managed participant with a caretaker.
export type AddParticipantInput = { displayName: string } & (
  | { email: string; managedByParticipantId?: undefined }
  | { email?: undefined; managedByParticipantId: string }
);

const findParticipantOfEvent = (
  db: Db,
  eventId: string,
  participantId: string,
) =>
  db
    .selectFrom('participants')
    .selectAll()
    .where('id', '=', participantId)
    .where('event_id', '=', eventId)
    .executeTakeFirst();

// Adds an active member participant silently (ADR-0003: no email; the
// invitation is a separate step). A managed participant's caretaker must be
// a non-managed participant of the same event.
export const addParticipant = async (
  db: Db,
  clock: Clock,
  eventId: string,
  input: AddParticipantInput,
): Promise<OrganizerParticipantDto> =>
  db.transaction().execute(async (trx) => {
    const { count } = await trx
      .selectFrom('participants')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('event_id', '=', eventId)
      .executeTakeFirstOrThrow();
    if (count >= MAX_PARTICIPANTS_PER_EVENT) {
      throw new AppError(
        httpStatus.CONFLICT,
        `An event can have at most ${MAX_PARTICIPANTS_PER_EVENT} participants`,
      );
    }

    let personId: string | null = null;
    let email: string | null = null;
    let caretakerId: string | null = null;
    if (input.email !== undefined) {
      const person = await findOrCreatePerson(trx, clock, input.email);
      const existing = await trx
        .selectFrom('participants')
        .select('id')
        .where('event_id', '=', eventId)
        .where('person_id', '=', person.id)
        .executeTakeFirst();
      if (existing) {
        throw new AppError(
          httpStatus.CONFLICT,
          'This person is already a participant',
        );
      }
      personId = person.id;
      email = person.email;
    } else {
      const caretaker = await findParticipantOfEvent(
        trx,
        eventId,
        input.managedByParticipantId,
      );
      if (!caretaker || caretaker.person_id === null) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          'The caretaker must be a non-managed participant of this event',
        );
      }
      caretakerId = caretaker.id;
    }

    const participant: ParticipantRow = {
      id: newId(),
      event_id: eventId,
      person_id: personId,
      managed_by_participant_id: caretakerId,
      display_name: input.displayName,
      role: 'member',
      status: 'active',
      added_at: nowUtc(clock),
      invite_sent_at: null,
      first_opened_at: null,
      responded_at: null,
    };
    await trx.insertInto('participants').values(participant).execute();

    return {
      ...toParticipantSummaryDto(participant),
      email,
      managedByParticipantId: caretakerId,
      inviteSentAt: null,
      firstOpenedAt: null,
      wishlistFilled: false,
    };
  });

// Removes a participant with their wishlists, exclusions and claims (the
// caller only allows this while the event is open). The organizer stays, and
// a caretaker stays until their managed participants are removed.
export const removeParticipant = async (
  db: Db,
  eventId: string,
  participantId: string,
): Promise<void> => {
  const participant = await findParticipantOfEvent(db, eventId, participantId);
  if (!participant) {
    throw new AppError(httpStatus.NOT_FOUND, 'Participant not found');
  }
  if (participant.role === 'organizer') {
    throw new AppError(httpStatus.CONFLICT, 'The organizer cannot be removed');
  }
  const managed = await db
    .selectFrom('participants')
    .select('id')
    .where('managed_by_participant_id', '=', participant.id)
    .executeTakeFirst();
  if (managed) {
    throw new AppError(
      httpStatus.CONFLICT,
      'Remove the managed participants of this caretaker first',
    );
  }

  await db
    .deleteFrom('participants')
    .where('id', '=', participant.id)
    .execute();
};

// Declines (leaves the draw) or rejoins. `responded_at` records the latest
// change; repeating the current status changes nothing.
export const setParticipation = async (
  db: Db,
  clock: Clock,
  participant: ParticipantRow,
  status: ParticipantStatus,
): Promise<ParticipantRow> => {
  if (participant.role === 'organizer' && status === 'declined') {
    throw new AppError(httpStatus.CONFLICT, 'The organizer cannot decline');
  }
  if (participant.status === status) return participant;

  return db
    .updateTable('participants')
    .set({ status, responded_at: nowUtc(clock) })
    .where('id', '=', participant.id)
    .returningAll()
    .executeTakeFirstOrThrow();
};

// Records the participant's first authenticated view of the event; later
// views keep the first timestamp.
export const recordFirstOpened = async (
  db: Db,
  clock: Clock,
  participant: ParticipantRow,
): Promise<void> => {
  if (participant.first_opened_at !== null) return;
  await db
    .updateTable('participants')
    .set({ first_opened_at: nowUtc(clock) })
    .where('id', '=', participant.id)
    .where('first_opened_at', 'is', null)
    .execute();
};
