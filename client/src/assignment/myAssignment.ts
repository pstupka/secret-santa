import type { LocationQueryValue, RouteLocationRaw } from 'vue-router';

import { api, isApiError, type Event, type MyAssignment } from '@/api';

// What the acting participant's assignment page shows.
export type AssignmentState =
  // The event is still open: nobody has an assignment yet.
  | { kind: 'notDrawn' }
  // Drawn, but the acting participant has no assignment: they declined
  // before the draw.
  | { kind: 'none' }
  | { kind: 'assigned'; assignment: MyAssignment };

// Loads the assignment of the acting participant (oneself, or a managed
// participant via `actingAs`). An open event is not asked about at all; a
// `404` after the draw means the participant was left out of it.
export const loadAssignmentState = async (
  event: Pick<Event, 'id' | 'status'>,
  actingAs: string | null,
  client: Pick<typeof api, 'getMyAssignment'> = api,
): Promise<AssignmentState> => {
  if (event.status === 'open') return { kind: 'notDrawn' };
  try {
    const assignment = await client.getMyAssignment(event.id, actingAs);
    return { kind: 'assigned', assignment };
  } catch (e) {
    if (isApiError(e) && e.kind === 'notFound') return { kind: 'none' };
    throw e;
  }
};

// The print view's location. The profile choice lives only in memory, so the
// acting managed participant travels in the query: `?as=<participantId>`.
export const printLocation = (
  eventId: string,
  actingAs: string | null,
): RouteLocationRaw => ({
  name: 'event-assignment-print',
  params: { eventId },
  query: actingAs ? { as: actingAs } : {},
});

// The managed participant id from the print view's `?as=`; null for oneself.
export const actingAsFromQuery = (
  value: LocationQueryValue | LocationQueryValue[] | undefined,
): string | null => {
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
};

// A wishlist item's link, only when it is a plain web address; anything else
// (e.g. `javascript:`) is not linked.
export const safeLink = (url: string | null): URL | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? parsed
      : null;
  } catch {
    return null;
  }
};
