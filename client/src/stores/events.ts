import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import {
  actingAsHeaders,
  api,
  type EventDetails,
  type MyEvent,
  type ParticipantSummary,
} from '@/api';
import { useAuthStore } from './auth';

// The participant the person acts as in an event: themselves, or (as a
// caretaker) one of their managed participants.
export interface ActingParticipant extends ParticipantSummary {
  isSelf: boolean;
}

// The person's events and the event currently open in the dashboard, plus the
// caretaker's profile switcher: who they act as in each event.
export const useEventsStore = defineStore('events', () => {
  // `GET /events`; null until loaded.
  const myEvents = ref<MyEvent[] | null>(null);
  // `GET /events/:id` of the event being viewed; null until loaded.
  const event = ref<EventDetails | null>(null);
  // Event id → managed participant id the caretaker acts as. Absent: self.
  const actingAsByEvent = ref<Record<string, string>>({});

  const loadMyEvents = async (): Promise<MyEvent[]> => {
    const events = await api.listMyEvents();
    myEvents.value = events;
    return events;
  };

  const loadEvent = async (eventId: string): Promise<EventDetails> => {
    if (event.value?.id !== eventId) event.value = null;
    const details = await api.getEvent(eventId);
    event.value = details;
    // Forget a profile the person no longer cares for.
    const actingAs = actingAsByEvent.value[eventId];
    if (
      actingAs &&
      !details.managedParticipants.some(({ id }) => id === actingAs)
    ) {
      delete actingAsByEvent.value[eventId];
    }
    return details;
  };

  // The person's own participant in the current event, with their name.
  const self = computed<ActingParticipant | null>(() => {
    if (!event.value) return null;
    const { myParticipant, participants } = event.value;
    const displayName =
      participants.find(({ id }) => id === myParticipant.id)?.displayName ?? '';
    return { ...myParticipant, displayName, isSelf: true };
  });

  // Whom the person acts as in the current event: themselves or a managed
  // participant chosen in the profile switcher.
  const actingParticipant = computed<ActingParticipant | null>(() => {
    if (!event.value) return null;
    const actingAs = actingAsByEvent.value[event.value.id];
    const managed = event.value.managedParticipants.find(
      ({ id }) => id === actingAs,
    );
    return managed ? { ...managed, isSelf: false } : self.value;
  });

  // The managed participant id to send as `X-Acting-As` in the current event;
  // null when acting as oneself.
  const actingAs = computed<string | null>(() =>
    actingParticipant.value && !actingParticipant.value.isSelf
      ? actingParticipant.value.id
      : null,
  );

  // Request headers for the current event's requests made on behalf of the
  // acting participant: `api.request(..., { headers: events.actingAsHeaders })`.
  const requestHeaders = computed(() => actingAsHeaders(actingAs.value));

  // Switches the profile in the current event: a managed participant's id, or
  // null for oneself. Ignores ids the person is not the caretaker of.
  const actAs = (participantId: string | null) => {
    if (!event.value) return;
    const eventId = event.value.id;
    if (
      participantId &&
      event.value.managedParticipants.some(({ id }) => id === participantId)
    ) {
      actingAsByEvent.value[eventId] = participantId;
    } else {
      delete actingAsByEvent.value[eventId];
    }
  };

  // Applies a participant's new status everywhere it is shown.
  const applyParticipant = (eventId: string, updated: ParticipantSummary) => {
    const replace = (list: ParticipantSummary[]) =>
      list.map((participant) =>
        participant.id === updated.id ? updated : participant,
      );
    if (event.value?.id === eventId) {
      const current = event.value;
      event.value = {
        ...current,
        participants: replace(current.participants),
        managedParticipants: replace(current.managedParticipants),
        myParticipant:
          current.myParticipant.id === updated.id
            ? { ...current.myParticipant, status: updated.status }
            : current.myParticipant,
      };
    }
    myEvents.value =
      myEvents.value?.map((myEvent) =>
        myEvent.id === eventId && myEvent.myParticipant.id === updated.id
          ? {
              ...myEvent,
              myParticipant: {
                ...myEvent.myParticipant,
                status: updated.status,
              },
            }
          : myEvent,
      ) ?? null;
  };

  // Declines the current event as the acting participant (open events only).
  const decline = async (): Promise<ParticipantSummary> => {
    if (!event.value) throw new Error('No event loaded');
    const eventId = event.value.id;
    const updated = await api.declineParticipation(eventId, actingAs.value);
    applyParticipant(eventId, updated);
    return updated;
  };

  // Rejoins the current event as the acting participant (open events only).
  const rejoin = async (): Promise<ParticipantSummary> => {
    if (!event.value) throw new Error('No event loaded');
    const eventId = event.value.id;
    const updated = await api.rejoinParticipation(eventId, actingAs.value);
    applyParticipant(eventId, updated);
    return updated;
  };

  const clear = () => {
    myEvents.value = null;
    event.value = null;
    actingAsByEvent.value = {};
  };

  // Another person may sign in on the same device: drop the previous one's
  // events.
  watch(
    () => useAuthStore().token,
    () => clear(),
  );

  return {
    myEvents,
    event,
    actingAsByEvent,
    self,
    actingParticipant,
    actingAs,
    requestHeaders,
    loadMyEvents,
    loadEvent,
    actAs,
    decline,
    rejoin,
    clear,
  };
});
