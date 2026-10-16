import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';

// An exclusion pair (GLOSSARY: Exclusion): neither participant may draw the
// other. Always normalised so that participantAId < participantBId.
export interface ExclusionDto {
  participantAId: string;
  participantBId: string;
  // A caretaker and their managed participant: always excluded and not
  // removable (PLAN.md, ADR-0005). Not stored in the `exclusions` table.
  builtIn: boolean;
}

const normalisedPair = (firstId: string, secondId: string): [string, string] =>
  firstId < secondId ? [firstId, secondId] : [secondId, firstId];

const toExclusionDto = (
  firstId: string,
  secondId: string,
  builtIn: boolean,
): ExclusionDto => {
  const [participantAId, participantBId] = normalisedPair(firstId, secondId);
  return { participantAId, participantBId, builtIn };
};

const pairKey = ({ participantAId, participantBId }: ExclusionDto) =>
  `${participantAId}:${participantBId}`;

// One pair per managed participant: with their caretaker.
const builtInExclusions = async (
  db: Db,
  eventId: string,
): Promise<ExclusionDto[]> => {
  const managed = await db
    .selectFrom('participants')
    .select(['id', 'managed_by_participant_id'])
    .where('event_id', '=', eventId)
    .where('managed_by_participant_id', 'is not', null)
    .execute();
  return managed.map((participant) =>
    toExclusionDto(
      participant.id,
      participant.managed_by_participant_id as string,
      true,
    ),
  );
};

const storedExclusions = async (
  db: Db,
  eventId: string,
): Promise<ExclusionDto[]> => {
  const rows = await db
    .selectFrom('exclusions')
    .select(['participant_a_id', 'participant_b_id'])
    .where('event_id', '=', eventId)
    .execute();
  return rows.map((row) =>
    toExclusionDto(row.participant_a_id, row.participant_b_id, false),
  );
};

const byPair = (left: ExclusionDto, right: ExclusionDto): number =>
  pairKey(left).localeCompare(pairKey(right));

// Every effective exclusion of the event: the organizer's pairs plus the
// built-in caretaker ↔ managed participant pairs, over all participants
// (declined ones included; the draw keeps only the pairs it needs). Each pair
// is listed once, ordered by participant ids.
export const listExclusions = async (
  db: Db,
  eventId: string,
): Promise<ExclusionDto[]> => {
  const builtIn = await builtInExclusions(db, eventId);
  const builtInKeys = new Set(builtIn.map(pairKey));
  const stored = (await storedExclusions(db, eventId)).filter(
    (pair) => !builtInKeys.has(pairKey(pair)),
  );
  return [...builtIn, ...stored].sort(byPair);
};

// Whether one of the two is the other's caretaker.
const isBuiltInPair = async (
  db: Db,
  eventId: string,
  [aId, bId]: [string, string],
): Promise<boolean> =>
  (await db
    .selectFrom('participants')
    .select('id')
    .where('event_id', '=', eventId)
    .where((eb) =>
      eb.or([
        eb.and([eb('id', '=', aId), eb('managed_by_participant_id', '=', bId)]),
        eb.and([eb('id', '=', bId), eb('managed_by_participant_id', '=', aId)]),
      ]),
    )
    .executeTakeFirst()) !== undefined;

const alwaysExcluded = () =>
  new AppError(
    httpStatus.CONFLICT,
    'A caretaker and their managed participant are always excluded',
  );

// Adds an exclusion between two different participants of the event, given
// in either order (the caller only allows this while the event is open).
// `409` if the pair is already excluded, built-in or stored.
export const addExclusion = async (
  db: Db,
  eventId: string,
  firstId: string,
  secondId: string,
): Promise<ExclusionDto> => {
  if (firstId === secondId) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An exclusion needs two different participants',
    );
  }
  const pair = normalisedPair(firstId, secondId);

  return db.transaction().execute(async (trx) => {
    const { count } = await trx
      .selectFrom('participants')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('event_id', '=', eventId)
      .where('id', 'in', pair)
      .executeTakeFirstOrThrow();
    if (count !== 2) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'Both must be participants of this event',
      );
    }
    if (await isBuiltInPair(trx, eventId, pair)) throw alwaysExcluded();

    const inserted = await trx
      .insertInto('exclusions')
      .values({
        event_id: eventId,
        participant_a_id: pair[0],
        participant_b_id: pair[1],
      })
      .onConflict((oc) => oc.doNothing())
      .executeTakeFirst();
    if (Number(inserted.numInsertedOrUpdatedRows ?? 0) === 0) {
      throw new AppError(httpStatus.CONFLICT, 'These are already excluded');
    }
    return toExclusionDto(pair[0], pair[1], false);
  });
};

// Removes an exclusion given in either order (the caller only allows this
// while the event is open). Built-in pairs cannot be removed.
export const removeExclusion = async (
  db: Db,
  eventId: string,
  firstId: string,
  secondId: string,
): Promise<void> => {
  const pair = normalisedPair(firstId, secondId);
  if (await isBuiltInPair(db, eventId, pair)) throw alwaysExcluded();

  const deleted = await db
    .deleteFrom('exclusions')
    .where('event_id', '=', eventId)
    .where('participant_a_id', '=', pair[0])
    .where('participant_b_id', '=', pair[1])
    .executeTakeFirst();
  if (Number(deleted.numDeletedRows) === 0) {
    throw new AppError(httpStatus.NOT_FOUND, 'Exclusion not found');
  }
};
