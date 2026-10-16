import { isApiError, type Event, type OrganizerParticipant } from '@/api';
import { daysUntilExchange } from '@/events/eventDetails';

// The draw needs at least this many non-declined participants (server rule).
export const MIN_DRAW_PARTICIPANTS = 3;

// Why the draw cannot run, as the server would answer with `422`.
export type DrawBlocker =
  | { kind: 'tooFewParticipants'; count: number }
  | { kind: 'notEveryoneInvited'; names: string[] };

// Participants the draw includes: everyone who has not declined.
export const drawnParticipants = (
  participants: OrganizerParticipant[],
): OrganizerParticipant[] =>
  participants.filter(({ status }) => status === 'active');

// What stops the draw that the organizer can see in advance. Impossible
// exclusions only show up when the draw is tried.
export const drawBlockers = (
  participants: OrganizerParticipant[],
): DrawBlocker[] => {
  const drawn = drawnParticipants(participants);
  const blockers: DrawBlocker[] = [];
  if (drawn.length < MIN_DRAW_PARTICIPANTS) {
    blockers.push({ kind: 'tooFewParticipants', count: drawn.length });
  }
  const notInvited = drawn.filter(
    (participant) =>
      participant.managedByParticipantId === null &&
      participant.role !== 'organizer' &&
      participant.inviteSentAt === null,
  );
  if (notInvited.length > 0) {
    blockers.push({
      kind: 'notEveryoneInvited',
      names: notInvited.map(({ displayName }) => displayName),
    });
  }
  return blockers;
};

// Why a draw request failed, as shown to the organizer. A `422` without a
// blocker visible in the (fresh) participant list means the exclusions make
// the draw impossible.
export type DrawFailure =
  | DrawBlocker
  | { kind: 'impossibleExclusions' }
  | { kind: 'redoTooLate' }
  | { kind: 'other' };

export const drawFailure = (
  error: unknown,
  participants: OrganizerParticipant[],
): DrawFailure => {
  if (!isApiError(error)) return { kind: 'other' };
  if (error.kind === 'unprocessable') {
    return drawBlockers(participants)[0] ?? { kind: 'impossibleExclusions' };
  }
  if (error.kind === 'conflict') return { kind: 'redoTooLate' };
  return { kind: 'other' };
};

// "16 października 2026 14:05" for an ISO timestamp, in the viewer's
// timezone unless one is given.
export const formatDrawnAt = (
  drawnAt: string,
  locale = 'pl-PL',
  timeZone?: string,
): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(drawnAt));

// What the draw button does: run the first draw, redo it before the exchange
// date, or nothing (finished, or the exchange date is today).
export const drawAction = (
  event: Pick<Event, 'status' | 'exchangeOn' | 'timezone'>,
  now = new Date(),
): 'draw' | 'redo' | null => {
  if (event.status === 'open') return 'draw';
  if (
    event.status === 'drawn' &&
    daysUntilExchange(event.exchangeOn, event.timezone, now) > 0
  ) {
    return 'redo';
  }
  return null;
};
