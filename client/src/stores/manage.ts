import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

import {
  api,
  type AddParticipantInput,
  type DrawDone,
  type Exclusion,
  type OrganizerParticipant,
  type UpdateEventInput,
} from '@/api';
import { normalisedPair } from '@/manage/exclusions';
import { useAuthStore } from './auth';
import { useEventsStore } from './events';

// The organizer's manage page: the participants with their invitation state
// and the exclusions of one event, plus every organizer action. Changes that
// show elsewhere (details, status, participant names) reload the event in the
// `events` store.
export const useManageStore = defineStore('manage', () => {
  const events = useEventsStore();

  // The event the lists below belong to; null until loaded.
  const eventId = ref<string | null>(null);
  const participants = ref<OrganizerParticipant[] | null>(null);
  const exclusions = ref<Exclusion[] | null>(null);

  const currentEventId = (): string => {
    if (!eventId.value) throw new Error('No event loaded');
    return eventId.value;
  };

  const loadParticipants = async (id: string) => {
    // The organizer always gets the organizer view.
    const list = (await api.listParticipants(id)) as OrganizerParticipant[];
    if (eventId.value === id) participants.value = list;
  };

  const load = async (id: string): Promise<void> => {
    if (eventId.value !== id) {
      participants.value = null;
      exclusions.value = null;
    }
    eventId.value = id;
    const [list, pairs] = await Promise.all([
      api.listParticipants(id) as Promise<OrganizerParticipant[]>,
      api.listExclusions(id),
    ]);
    if (eventId.value !== id) return;
    participants.value = list;
    exclusions.value = pairs;
  };

  const reloadEvent = (id: string) => events.loadEvent(id);

  const updateEvent = async (input: UpdateEventInput): Promise<void> => {
    const id = currentEventId();
    await api.updateEvent(id, input);
    await reloadEvent(id);
  };

  const deleteEvent = async (): Promise<void> => {
    const id = currentEventId();
    await api.deleteEvent(id);
    // `events.event` stays until the caller navigates away, so the event
    // layout does not flash its loading state; loading it again gives `404`.
    events.myEvents =
      events.myEvents?.filter((myEvent) => myEvent.id !== id) ?? null;
    clear();
  };

  const addParticipant = async (
    input: AddParticipantInput,
  ): Promise<OrganizerParticipant> => {
    const id = currentEventId();
    const added = await api.addParticipant(id, input);
    participants.value = [...(participants.value ?? []), added];
    // A managed participant is always excluded with their caretaker.
    if (added.managedByParticipantId) {
      exclusions.value = await api.listExclusions(id);
    }
    await reloadEvent(id);
    return added;
  };

  const removeParticipant = async (participantId: string): Promise<void> => {
    const id = currentEventId();
    await api.removeParticipant(id, participantId);
    participants.value =
      participants.value?.filter(({ id: pid }) => pid !== participantId) ??
      null;
    exclusions.value =
      exclusions.value?.filter(
        ({ participantAId, participantBId }) =>
          participantAId !== participantId && participantBId !== participantId,
      ) ?? null;
    await reloadEvent(id);
  };

  // Invites everyone not invited yet; resolves with how many were sent.
  const sendPendingInvitations = async (): Promise<number> => {
    const id = currentEventId();
    const { sent } = await api.sendPendingInvitations(id);
    await loadParticipants(id);
    return sent;
  };

  const sendInvitation = async (participantId: string): Promise<void> => {
    const id = currentEventId();
    const { inviteSentAt } = await api.sendInvitation(id, participantId);
    participants.value =
      participants.value?.map((participant) =>
        participant.id === participantId
          ? { ...participant, inviteSentAt }
          : participant,
      ) ?? null;
  };

  const addExclusion = async (
    firstId: string,
    secondId: string,
  ): Promise<void> => {
    const id = currentEventId();
    const [aId, bId] = normalisedPair(firstId, secondId);
    const added = await api.addExclusion(id, aId, bId);
    exclusions.value = [...(exclusions.value ?? []), added];
  };

  const removeExclusion = async ({
    participantAId,
    participantBId,
  }: Exclusion): Promise<void> => {
    const id = currentEventId();
    await api.removeExclusion(id, participantAId, participantBId);
    exclusions.value =
      exclusions.value?.filter(
        (exclusion) =>
          exclusion.participantAId !== participantAId ||
          exclusion.participantBId !== participantBId,
      ) ?? null;
  };

  // Runs or redoes the draw. On failure the participants are refreshed, so
  // the reason (`drawFailure`) is judged on the current list.
  const runDraw = async (): Promise<DrawDone> => {
    const id = currentEventId();
    try {
      const done = await api.runDraw(id);
      await reloadEvent(id);
      return done;
    } catch (error) {
      await loadParticipants(id).catch(() => undefined);
      throw error;
    }
  };

  const clear = () => {
    eventId.value = null;
    participants.value = null;
    exclusions.value = null;
  };

  // Another person may sign in on the same device.
  watch(
    () => useAuthStore().token,
    () => clear(),
  );

  return {
    eventId,
    participants,
    exclusions,
    load,
    updateEvent,
    deleteEvent,
    addParticipant,
    removeParticipant,
    sendPendingInvitations,
    sendInvitation,
    addExclusion,
    removeExclusion,
    runDraw,
    clear,
  };
});
