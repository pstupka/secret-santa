import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import {
  EventRow,
  EventUpdate,
  ParticipantRole,
  ParticipantRow,
  ParticipantStatus,
} from '@db/schema';
import { enqueueEmail } from '@email/outbox';
import { Clock, nowUtc } from '@shared/clock';
import { todayIn } from '@shared/dates';
import newId from '@shared/ids';
import { issueMagicToken } from '@components/auth/magicToken';
import { findOrCreatePerson } from '@components/persons/persons';
import {
  listManagedParticipantsOf,
  listParticipantSummaries,
  ParticipantSummaryDto,
} from '@components/participants/participants.service';

// 'finished' is never stored: it is derived from exchange_on (PLAN.md lifecycle).
export type EventStatus = 'open' | 'drawn' | 'finished';

export interface EventDto {
  id: string;
  title: string;
  description: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  rules: string | null;
  timezone: string;
  exchangeOn: string;
  status: EventStatus;
  drawnAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// The event is finished once its exchange date has passed in its timezone.
export const eventStatus = (event: EventRow, clock: Clock): EventStatus =>
  todayIn(event.timezone, clock) > event.exchange_on
    ? 'finished'
    : event.status;

export const toEventDto = (event: EventRow, clock: Clock): EventDto => ({
  id: event.id,
  title: event.title,
  description: event.description,
  budgetAmount: event.budget_amount,
  budgetCurrency: event.budget_currency,
  rules: event.rules,
  timezone: event.timezone,
  exchangeOn: event.exchange_on,
  status: eventStatus(event, clock),
  drawnAt: event.drawn_at,
  createdAt: event.created_at,
  updatedAt: event.updated_at,
});

const assertExchangeOnNotPast = (
  exchangeOn: string,
  timezone: string,
  clock: Clock,
) => {
  if (exchangeOn < todayIn(timezone, clock)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      '"exchangeOn" must not be in the past',
    );
  }
};

export interface CreateEventInput {
  title: string;
  description: string | null;
  budgetAmount?: number;
  budgetCurrency?: string;
  rules: string | null;
  timezone: string;
  exchangeOn: string;
  organizerName: string;
  organizerEmail: string;
}

// Creates the event with its organizer participant and queues the organizer's
// personal link, all in one transaction. The raw magic token only goes to the
// outbox, never to the caller.
export const createEvent = async (
  db: Db,
  clock: Clock,
  input: CreateEventInput,
): Promise<EventRow> => {
  assertExchangeOnNotPast(input.exchangeOn, input.timezone, clock);

  return db.transaction().execute(async (trx) => {
    const now = nowUtc(clock);
    const person = await findOrCreatePerson(trx, clock, input.organizerEmail);

    const event: EventRow = {
      id: newId(),
      title: input.title,
      description: input.description,
      budget_amount: input.budgetAmount ?? null,
      budget_currency: input.budgetCurrency ?? null,
      rules: input.rules,
      timezone: input.timezone,
      exchange_on: input.exchangeOn,
      status: 'open',
      drawn_at: null,
      created_at: now,
      updated_at: now,
    };
    await trx.insertInto('events').values(event).execute();

    await trx
      .insertInto('participants')
      .values({
        id: newId(),
        event_id: event.id,
        person_id: person.id,
        managed_by_participant_id: null,
        display_name: input.organizerName,
        role: 'organizer',
        status: 'active',
        added_at: now,
        // The organizer-link email is the organizer's invitation: bulk sends
        // skip them and the draw counts them as invited.
        invite_sent_at: now,
      })
      .execute();

    const token = await issueMagicToken(trx, clock, person.id);
    await enqueueEmail(trx, clock, {
      to: person.email,
      template: 'organizer-link',
      payload: {
        token,
        organizerName: input.organizerName,
        eventTitle: input.title,
      },
    });

    return event;
  });
};

// The caller's own participant in an event.
export interface MyParticipantDto {
  id: string;
  role: ParticipantRole;
  status: ParticipantStatus;
}

export interface MyEventDto extends EventDto {
  myParticipant: MyParticipantDto;
}

const toMyEventDto = (
  event: EventRow,
  participant: Pick<ParticipantRow, 'id' | 'role' | 'status'>,
  clock: Clock,
): MyEventDto => ({
  ...toEventDto(event, clock),
  myParticipant: {
    id: participant.id,
    role: participant.role,
    status: participant.status,
  },
});

// Every event the person participates in (any status), soonest exchange
// date first.
export const listEventsOf = async (
  db: Db,
  clock: Clock,
  personId: string,
): Promise<MyEventDto[]> => {
  const rows = await db
    .selectFrom('participants')
    .innerJoin('events', 'events.id', 'participants.event_id')
    .selectAll('events')
    .select([
      'participants.id as participantId',
      'participants.role as participantRole',
      'participants.status as participantStatus',
    ])
    .where('participants.person_id', '=', personId)
    .orderBy('events.exchange_on')
    .orderBy('events.created_at')
    .execute();

  return rows.map(
    ({ participantId, participantRole, participantStatus, ...event }) =>
      toMyEventDto(
        event,
        { id: participantId, role: participantRole, status: participantStatus },
        clock,
      ),
  );
};

export interface EventDetailsDto extends MyEventDto {
  participants: ParticipantSummaryDto[];
  // The caller's managed participants, whom they can act as (`X-Acting-As`).
  managedParticipants: ParticipantSummaryDto[];
}

export const getEventDetails = async (
  db: Db,
  clock: Clock,
  event: EventRow,
  myParticipant: ParticipantRow,
): Promise<EventDetailsDto> => ({
  ...toMyEventDto(event, myParticipant, clock),
  participants: await listParticipantSummaries(db, event.id),
  managedParticipants: await listManagedParticipantsOf(db, myParticipant),
});

// Fields the organizer can edit; absent fields are left unchanged.
export interface UpdateEventInput {
  title?: string;
  description?: string | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  rules?: string | null;
  timezone?: string;
  exchangeOn?: string;
}

export const updateEvent = async (
  db: Db,
  clock: Clock,
  event: EventRow,
  input: UpdateEventInput,
): Promise<EventRow> => {
  // Checked whenever either changes: moving the event to a timezone where the
  // exchange date has already passed would finish it.
  if (input.exchangeOn !== undefined || input.timezone !== undefined) {
    assertExchangeOnNotPast(
      input.exchangeOn ?? event.exchange_on,
      input.timezone ?? event.timezone,
      clock,
    );
  }

  const update: EventUpdate = {
    title: input.title,
    description: input.description,
    budget_amount: input.budgetAmount,
    budget_currency: input.budgetCurrency,
    rules: input.rules,
    timezone: input.timezone,
    exchange_on: input.exchangeOn,
    updated_at: nowUtc(clock),
  };
  return db
    .updateTable('events')
    .set(update)
    .where('id', '=', event.id)
    .returningAll()
    .executeTakeFirstOrThrow();
};

// Hard delete: participants, wishlists, exclusions and assignments go with
// the event (ON DELETE CASCADE).
export const deleteEvent = async (db: Db, eventId: string): Promise<void> => {
  await db.deleteFrom('events').where('id', '=', eventId).execute();
};
