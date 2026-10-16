import type { EventStatus, OrganizerParticipant } from '@/api';

// What the organizer sees about a participant's invitation. A managed
// participant never gets one: they are in the draw from the start.
export type InviteState =
  | 'managed'
  | 'notInvited'
  | 'invited'
  | 'opened'
  | 'declined';

export const inviteState = (participant: OrganizerParticipant): InviteState => {
  if (participant.managedByParticipantId !== null) return 'managed';
  if (participant.status === 'declined') return 'declined';
  if (participant.firstOpenedAt !== null) return 'opened';
  if (participant.inviteSentAt !== null) return 'invited';
  return 'notInvited';
};

// Participants the bulk "send invitations" reaches: everyone with an email
// who has not been invited yet (the organizer already has their link).
export const pendingInvitees = (
  participants: OrganizerParticipant[],
): OrganizerParticipant[] =>
  participants.filter(
    (participant) =>
      participant.managedByParticipantId === null &&
      participant.role !== 'organizer' &&
      participant.inviteSentAt === null,
  );

// The per-participant invitation action while the event is open: send the
// first one, or resend it with a fresh personal link. None for managed
// participants (no email) and the organizer (who has their link already).
export const invitationAction = (
  participant: OrganizerParticipant,
): 'send' | 'resend' | null => {
  if (
    participant.managedByParticipantId !== null ||
    participant.role === 'organizer'
  ) {
    return null;
  }
  return participant.inviteSentAt === null ? 'send' : 'resend';
};

// Why a participant cannot be removed, or null if they can. Membership is
// locked once the event is drawn.
export type RemovalBlock = 'organizer' | 'caretaker';

export const removalBlock = (
  participant: OrganizerParticipant,
  participants: OrganizerParticipant[],
): RemovalBlock | null => {
  if (participant.role === 'organizer') return 'organizer';
  if (
    participants.some(
      ({ managedByParticipantId }) => managedByParticipantId === participant.id,
    )
  ) {
    return 'caretaker';
  }
  return null;
};

// Who can be a managed participant's caretaker: a participant with an email.
export const caretakerCandidates = (
  participants: OrganizerParticipant[],
): OrganizerParticipant[] =>
  participants.filter(
    ({ managedByParticipantId }) => managedByParticipantId === null,
  );

// Membership (adding, removing, inviting) and exclusions can change only
// while the event is open.
export const isMembershipOpen = (status: EventStatus): boolean =>
  status === 'open';
