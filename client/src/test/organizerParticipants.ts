import type { OrganizerParticipant } from '@/api';

// Organizer-view participants for tests: Jan organizes, Ania was invited,
// Babcia Zosia is managed by Ania.
export const organizerParticipant = (
  overrides: Partial<OrganizerParticipant> = {},
): OrganizerParticipant => ({
  id: 'p',
  displayName: 'P',
  role: 'member',
  status: 'active',
  email: 'p@example.com',
  managedByParticipantId: null,
  inviteSentAt: null,
  firstOpenedAt: null,
  wishlistFilled: false,
  ...overrides,
});

export const jan = organizerParticipant({
  id: 'jan',
  displayName: 'Jan',
  role: 'organizer',
  email: 'jan@example.com',
  inviteSentAt: '2026-10-16T10:00:00.000Z',
  firstOpenedAt: '2026-10-16T10:05:00.000Z',
});

export const ania = organizerParticipant({
  id: 'ania',
  displayName: 'Ania',
  email: 'ania@example.com',
  inviteSentAt: '2026-10-16T11:00:00.000Z',
});

export const babcia = organizerParticipant({
  id: 'babcia',
  displayName: 'Babcia Zosia',
  email: null,
  managedByParticipantId: 'ania',
});

export const piotr = organizerParticipant({
  id: 'piotr',
  displayName: 'Piotr',
  email: 'piotr@example.com',
});
