import type { EventStatus, OrganizerParticipant } from '@/api';
import { drawBlockers } from '@/manage/draw';

// The organizer's way through an event: gather participants, invite them,
// run the draw.
export const MANAGE_STEPS = ['participants', 'invitations', 'draw'] as const;

export type ManageStep = (typeof MANAGE_STEPS)[number];

// The step the organizer should do next, or `null` once the draw is done.
export const currentStep = (
  status: EventStatus,
  participants: OrganizerParticipant[],
): ManageStep | null => {
  if (status !== 'open') return null;
  const blockers = drawBlockers(participants);
  if (blockers.some(({ kind }) => kind === 'tooFewParticipants')) {
    return 'participants';
  }
  if (blockers.some(({ kind }) => kind === 'notEveryoneInvited')) {
    return 'invitations';
  }
  return 'draw';
};

// Whether a step is finished, the one to do now, or still ahead.
export const stepState = (
  step: ManageStep,
  current: ManageStep | null,
): 'done' | 'current' | 'upcoming' => {
  if (current === null) return 'done';
  const index = MANAGE_STEPS.indexOf(step);
  const currentIndex = MANAGE_STEPS.indexOf(current);
  if (index < currentIndex) return 'done';
  return index === currentIndex ? 'current' : 'upcoming';
};
