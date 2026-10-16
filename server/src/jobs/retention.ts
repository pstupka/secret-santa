import { Db } from '@db/database';
import { Clock, toUtcTimestamp } from '@shared/clock';
import { daysBetween, todayIn } from '@shared/dates';

// How long an event is kept after its exchange date.
export const EVENT_RETENTION_DAYS = 60;
// How long a sent email stays in the outbox.
export const SENT_EMAIL_RETENTION_DAYS = 7;

export interface RetentionResult {
  events: number;
  persons: number;
  sentEmails: number;
}

// True once more than EVENT_RETENTION_DAYS whole days have passed since the
// exchange date, counted in the event's timezone: an event exchanging on
// 2026-12-24 is kept through 2027-02-22 and deleted from 2027-02-23 (local).
export const isPastRetention = (
  event: { exchange_on: string; timezone: string },
  clock: Clock,
): boolean =>
  daysBetween(event.exchange_on, todayIn(event.timezone, clock)) >
  EVENT_RETENTION_DAYS;

// Hard-deletes data nobody needs any more (PLAN.md, Deployment), in one
// transaction:
// 1. events past retention, with everything hanging off them (participants,
//    wishlists, claims, exclusions, assignments cascade);
// 2. persons left without any participation, with their magic tokens;
// 3. sent emails older than SENT_EMAIL_RETENTION_DAYS (unsent ones stay).
export const applyRetention = (
  db: Db,
  clock: Clock,
): Promise<RetentionResult> =>
  db.transaction().execute(async (trx) => {
    const events = await trx
      .selectFrom('events')
      .select(['id', 'exchange_on', 'timezone'])
      .execute();
    const expiredEventIds = events
      .filter((event) => isPastRetention(event, clock))
      .map((event) => event.id);
    if (expiredEventIds.length > 0) {
      await trx
        .deleteFrom('events')
        .where('id', 'in', expiredEventIds)
        .execute();
    }

    const orphanedPersonIds = (
      await trx
        .selectFrom('persons')
        .select('persons.id')
        .where(({ not, exists, selectFrom }) =>
          not(
            exists(
              selectFrom('participants')
                .select('participants.id')
                .whereRef('participants.person_id', '=', 'persons.id'),
            ),
          ),
        )
        .execute()
    ).map((person) => person.id);
    if (orphanedPersonIds.length > 0) {
      // Tokens would also cascade with their person; deleted explicitly so
      // retention does not depend on the foreign_keys pragma.
      await trx
        .deleteFrom('access_tokens')
        .where('person_id', 'in', orphanedPersonIds)
        .execute();
      await trx
        .deleteFrom('persons')
        .where('id', 'in', orphanedPersonIds)
        .execute();
    }

    const sentBefore = toUtcTimestamp(
      new Date(
        clock.now().getTime() - SENT_EMAIL_RETENTION_DAYS * 24 * 60 * 60 * 1000,
      ),
    );
    const sentEmails = await trx
      .deleteFrom('email_outbox')
      .where('sent_at', 'is not', null)
      .where('sent_at', '<', sentBefore)
      .executeTakeFirst();

    return {
      events: expiredEventIds.length,
      persons: orphanedPersonIds.length,
      sentEmails: Number(sentEmails.numDeletedRows),
    };
  });
