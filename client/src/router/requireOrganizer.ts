import type { NavigationGuard } from 'vue-router';

import { useEventsStore } from '@/stores/events';

// `beforeEnter` of organizer-only event sections: anyone else is sent to the
// event dashboard. Loads the event when the layout has not yet; if that
// fails, lets the navigation through so the layout shows the error.
export const requireOrganizer: NavigationGuard = async (to) => {
  const eventId = String(to.params.eventId);
  const events = useEventsStore();
  let event = events.event?.id === eventId ? events.event : null;
  if (!event) {
    try {
      event = await events.loadEvent(eventId);
    } catch {
      return true;
    }
  }
  return event.myParticipant.role === 'organizer'
    ? true
    : { name: 'event', params: { eventId } };
};
