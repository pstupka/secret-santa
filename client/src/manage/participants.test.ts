import { describe, expect, test } from 'vitest';

import {
  ania,
  babcia,
  jan,
  organizerParticipant,
  piotr,
} from '@/test/organizerParticipants';
import {
  caretakerCandidates,
  invitationAction,
  inviteState,
  isMembershipOpen,
  pendingInvitees,
  removalBlock,
} from './participants';

describe('inviteState', () => {
  test('a participant not invited yet', () => {
    expect(inviteState(piotr)).toBe('notInvited');
  });

  test('an invited participant', () => {
    expect(inviteState(ania)).toBe('invited');
  });

  test('a participant who opened their personal link', () => {
    expect(inviteState(jan)).toBe('opened');
  });

  test('a declined participant, whatever their invitation', () => {
    expect(inviteState({ ...jan, role: 'member', status: 'declined' })).toBe(
      'declined',
    );
  });

  test('a managed participant gets no invitation', () => {
    expect(inviteState(babcia)).toBe('managed');
  });
});

describe('pendingInvitees', () => {
  test('everyone with an email who has not been invited', () => {
    const marta = organizerParticipant({ id: 'marta', displayName: 'Marta' });

    expect(pendingInvitees([jan, ania, babcia, piotr, marta])).toEqual([
      piotr,
      marta,
    ]);
  });

  test('never the organizer, even without an invitation', () => {
    expect(pendingInvitees([{ ...jan, inviteSentAt: null }])).toEqual([]);
  });
});

describe('invitationAction', () => {
  test('sends the first invitation', () => {
    expect(invitationAction(piotr)).toBe('send');
  });

  test('resends an invitation', () => {
    expect(invitationAction(ania)).toBe('resend');
  });

  test('nothing for a managed participant or the organizer', () => {
    expect(invitationAction(babcia)).toBeNull();
    expect(invitationAction(jan)).toBeNull();
  });
});

describe('removalBlock', () => {
  const participants = [jan, ania, babcia, piotr];

  test('a member can be removed', () => {
    expect(removalBlock(piotr, participants)).toBeNull();
    expect(removalBlock(babcia, participants)).toBeNull();
  });

  test('the organizer cannot be removed', () => {
    expect(removalBlock(jan, participants)).toBe('organizer');
  });

  test('a caretaker cannot be removed before their managed participants', () => {
    expect(removalBlock(ania, participants)).toBe('caretaker');
  });
});

test('caretakers are participants with an email', () => {
  expect(caretakerCandidates([jan, ania, babcia, piotr])).toEqual([
    jan,
    ania,
    piotr,
  ]);
});

test('membership changes only while the event is open', () => {
  expect(isMembershipOpen('open')).toBe(true);
  expect(isMembershipOpen('drawn')).toBe(false);
  expect(isMembershipOpen('finished')).toBe(false);
});
