import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import { EventRow, ParticipantRow } from '@db/schema';
import { enqueueEmail } from '@email/outbox';
import { Clock, nowUtc } from '@shared/clock';
import { todayIn } from '@shared/dates';
import { EventDto, toEventDto } from '@components/events/events.service';
import { listExclusions } from '@components/exclusions/exclusions.service';
import {
  findOwnWishlist,
  WishlistDto,
} from '@components/wishlists/wishlists.service';
import {
  cryptoRandomInt,
  draw,
  ExclusionPair,
  RandomInt,
} from './drawAlgorithm';

// The draw (ADR-0005): assignments are secret. Nothing here returns, logs or
// emails a pair to anyone but its giver (or the giver's caretaker).

export const MIN_DRAW_PARTICIPANTS = 3;

export interface DrawDoneDto {
  event: EventDto;
  // How many participants were drawn (and get a draw-result email).
  participantCount: number;
}

// A drawn participant with where their draw-result email goes: their own
// email, or their caretaker's for a managed participant.
interface DrawnParticipant {
  id: string;
  display_name: string;
  role: ParticipantRow['role'];
  invite_sent_at: string | null;
  person_id: string | null;
  email: string | null;
  caretaker_name: string | null;
  caretaker_email: string | null;
}

// Every non-declined participant of the event.
const drawnParticipantsOf = (trx: Db, eventId: string) =>
  trx
    .selectFrom('participants')
    .leftJoin('persons', 'persons.id', 'participants.person_id')
    .leftJoin(
      'participants as caretakers',
      'caretakers.id',
      'participants.managed_by_participant_id',
    )
    .leftJoin(
      'persons as caretaker_persons',
      'caretaker_persons.id',
      'caretakers.person_id',
    )
    .select([
      'participants.id',
      'participants.display_name',
      'participants.role',
      'participants.invite_sent_at',
      'participants.person_id',
      'persons.email',
      'caretakers.display_name as caretaker_name',
      'caretaker_persons.email as caretaker_email',
    ])
    .where('participants.event_id', '=', eventId)
    .where('participants.status', '=', 'active')
    .orderBy('participants.added_at')
    .orderBy('participants.id')
    .execute() as Promise<DrawnParticipant[]>;

const unprocessable = (message: string) =>
  new AppError(httpStatus.UNPROCESSABLE_ENTITY, message);

// Runs the draw on an open event, or redoes it on a drawn one before its
// exchange date, replacing every assignment. In one transaction: writes the
// assignments, marks the event drawn and enqueues a draw-result email per
// drawn participant (a managed participant's goes to their caretaker).
export const runDraw = async (
  db: Db,
  clock: Clock,
  event: EventRow,
  random: RandomInt = cryptoRandomInt,
): Promise<DrawDoneDto> => {
  if (
    event.status === 'drawn' &&
    todayIn(event.timezone, clock) >= event.exchange_on
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      'The draw can only be redone before the exchange date',
    );
  }

  return db.transaction().execute(async (trx) => {
    const participants = await drawnParticipantsOf(trx, event.id);
    if (participants.length < MIN_DRAW_PARTICIPANTS) {
      throw unprocessable(
        `The draw needs at least ${MIN_DRAW_PARTICIPANTS} participants`,
      );
    }
    // Managed participants are never invited; the organizer always is.
    if (
      participants.some(
        (participant) =>
          participant.person_id !== null &&
          participant.role !== 'organizer' &&
          participant.invite_sent_at === null,
      )
    ) {
      throw unprocessable('Every participant must be invited before the draw');
    }

    const exclusions = (await listExclusions(trx, event.id)).map(
      ({ participantAId, participantBId }): ExclusionPair => [
        participantAId,
        participantBId,
      ],
    );
    const result = draw(
      participants.map((participant) => participant.id),
      exclusions,
      random,
    );
    if (!result.possible) {
      throw unprocessable('The exclusions make the draw impossible');
    }

    const now = nowUtc(clock);
    await trx
      .deleteFrom('assignments')
      .where('event_id', '=', event.id)
      .execute();
    await trx
      .insertInto('assignments')
      .values(
        [...result.assignments].map(([giverId, receiverId]) => ({
          event_id: event.id,
          giver_id: giverId,
          receiver_id: receiverId,
        })),
      )
      .execute();
    const drawnEvent = await trx
      .updateTable('events')
      .set({ status: 'drawn', drawn_at: now, updated_at: now })
      .where('id', '=', event.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    const byId = new Map(participants.map((p) => [p.id, p]));
    // Sequential: one SQLite transaction runs one statement at a time anyway.
    // eslint-disable-next-line no-restricted-syntax
    for (const giver of participants) {
      const recipient = byId.get(result.assignments.get(giver.id) as string);
      const managed = giver.person_id === null;
      // eslint-disable-next-line no-await-in-loop
      await enqueueEmail(trx, clock, {
        to: (managed ? giver.caretaker_email : giver.email) as string,
        template: 'draw-result',
        payload: {
          eventId: event.id,
          eventTitle: drawnEvent.title,
          exchangeOn: drawnEvent.exchange_on,
          giverName: giver.display_name,
          recipientName: (recipient as DrawnParticipant).display_name,
          caretakerName: managed ? giver.caretaker_name : null,
        },
      });
    }

    return {
      event: toEventDto(drawnEvent, clock),
      participantCount: participants.length,
    };
  });
};

export interface MyAssignmentDto {
  // The participant the giver gives a gift to.
  recipient: { id: string; displayName: string };
  // The recipient's own wishlist, or null if they have none yet.
  wishlist: WishlistDto | null;
}

// The giver's own assignment with the recipient's own wishlist. `404` while
// the giver has none: before the draw, or when they declined before it.
export const findMyAssignment = async (
  db: Db,
  giver: ParticipantRow,
): Promise<MyAssignmentDto> => {
  const recipient = await db
    .selectFrom('assignments')
    .innerJoin('participants', 'participants.id', 'assignments.receiver_id')
    .select(['participants.id', 'participants.display_name'])
    .where('assignments.event_id', '=', giver.event_id)
    .where('assignments.giver_id', '=', giver.id)
    .executeTakeFirst();
  if (!recipient) {
    throw new AppError(httpStatus.NOT_FOUND, 'No assignment');
  }
  return {
    recipient: { id: recipient.id, displayName: recipient.display_name },
    wishlist: (await findOwnWishlist(db, recipient.id)) ?? null,
  };
};
