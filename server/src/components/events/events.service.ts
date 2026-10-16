import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import { EventRow } from '@db/schema';
import { enqueueEmail } from '@email/outbox';
import { Clock, nowUtc } from '@shared/clock';
import { todayIn } from '@shared/dates';
import newId from '@shared/ids';
import { issueMagicToken } from '@components/auth/magicToken';
import { findOrCreatePerson } from '@components/persons/persons';

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
  if (input.exchangeOn < todayIn(input.timezone, clock)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      '"exchangeOn" must not be in the past',
    );
  }

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
