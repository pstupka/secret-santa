import { describe, expect, test } from 'vitest';

import { ApiError } from '@/api';
import { ania, babcia, jan, piotr } from '@/test/organizerParticipants';
import {
  drawAction,
  drawBlockers,
  drawFailure,
  drawnParticipants,
  formatDrawnAt,
} from './draw';

const invitedPiotr = { ...piotr, inviteSentAt: '2026-10-16T12:00:00.000Z' };

describe('drawBlockers', () => {
  test('nothing blocks a draw of three invited participants', () => {
    expect(drawBlockers([jan, ania, invitedPiotr])).toEqual([]);
  });

  test('managed participants need no invitation', () => {
    expect(drawBlockers([jan, ania, babcia])).toEqual([]);
  });

  test('needs at least three participants who have not declined', () => {
    const declinedPiotr = { ...invitedPiotr, status: 'declined' as const };

    expect(drawBlockers([jan, ania, declinedPiotr])).toEqual([
      { kind: 'tooFewParticipants', count: 2 },
    ]);
  });

  test('needs everyone with an email to be invited', () => {
    expect(drawBlockers([jan, ania, piotr])).toEqual([
      { kind: 'notEveryoneInvited', names: ['Piotr'] },
    ]);
  });

  test('ignores declined participants who were never invited', () => {
    const declinedPiotr = { ...piotr, status: 'declined' as const };

    expect(drawBlockers([jan, ania, babcia, declinedPiotr])).toEqual([]);
  });

  test('lists every blocker', () => {
    expect(drawBlockers([jan, piotr])).toEqual([
      { kind: 'tooFewParticipants', count: 2 },
      { kind: 'notEveryoneInvited', names: ['Piotr'] },
    ]);
  });
});

test('the draw includes everyone who has not declined', () => {
  const declinedPiotr = { ...piotr, status: 'declined' as const };

  expect(drawnParticipants([jan, ania, declinedPiotr])).toEqual([jan, ania]);
});

describe('drawFailure', () => {
  const unprocessable = new ApiError('unprocessable', 422, 'Unprocessable');

  test('explains a 422 with what blocks the draw', () => {
    expect(drawFailure(unprocessable, [jan, ania, piotr])).toEqual({
      kind: 'notEveryoneInvited',
      names: ['Piotr'],
    });
  });

  test('a 422 with nothing else blocking means impossible exclusions', () => {
    expect(drawFailure(unprocessable, [jan, ania, invitedPiotr])).toEqual({
      kind: 'impossibleExclusions',
    });
  });

  test('a 409 means the draw can no longer be redone', () => {
    expect(
      drawFailure(new ApiError('conflict', 409, 'Conflict'), [jan]),
    ).toEqual({ kind: 'redoTooLate' });
  });

  test('anything else is a generic failure', () => {
    expect(drawFailure(new ApiError('network', 0, 'offline'), [])).toEqual({
      kind: 'other',
    });
    expect(drawFailure(new Error('boom'), [])).toEqual({ kind: 'other' });
  });
});

describe('drawAction', () => {
  const now = new Date('2026-12-20T12:00:00Z');
  const event = { exchangeOn: '2026-12-24', timezone: 'Europe/Warsaw' };

  test('runs the first draw on an open event', () => {
    expect(drawAction({ ...event, status: 'open' }, now)).toBe('draw');
  });

  test('redoes the draw before the exchange date', () => {
    expect(drawAction({ ...event, status: 'drawn' }, now)).toBe('redo');
  });

  test('cannot redo on the exchange date', () => {
    expect(
      drawAction(
        { ...event, status: 'drawn' },
        new Date('2026-12-24T08:00:00Z'),
      ),
    ).toBeNull();
  });

  test('counts the exchange date in the event timezone', () => {
    // 23:30 UTC on the 23rd is already the 24th in Warsaw.
    expect(
      drawAction(
        { ...event, status: 'drawn' },
        new Date('2026-12-23T23:30:00Z'),
      ),
    ).toBeNull();
  });

  test('nothing once the event is finished', () => {
    expect(drawAction({ ...event, status: 'finished' }, now)).toBeNull();
  });
});

test('formats when the draw happened', () => {
  expect(
    formatDrawnAt('2026-10-16T12:05:00.000Z', 'pl-PL', 'Europe/Warsaw'),
  ).toBe('16 października 2026 14:05');
});
