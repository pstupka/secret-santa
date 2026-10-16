<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import DeleteEventPanel from '@/components/manage/DeleteEventPanel.vue';
import DrawPanel from '@/components/manage/DrawPanel.vue';
import EditEventForm from '@/components/manage/EditEventForm.vue';
import ExclusionsEditor from '@/components/manage/ExclusionsEditor.vue';
import InvitationsPanel from '@/components/manage/InvitationsPanel.vue';
import ParticipantsManager from '@/components/manage/ParticipantsManager.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { isMembershipOpen } from '@/manage/participants';
import { useEventsStore } from '@/stores/events';
import { useManageStore } from '@/stores/manage';

// `/events/:eventId/manage` (organizer only; see `requireOrganizer`):
// participants and invitations, exclusions, the draw, event details and
// deleting the event. Rendered inside `EventView`, which loads the event.
const events = useEventsStore();
const manage = useManageStore();
const errorMessage = useApiErrorMessage();

const event = computed(() => events.event);
const isOrganizer = computed(
  () => event.value?.myParticipant.role === 'organizer',
);
const membershipOpen = computed(
  () => !!event.value && isMembershipOpen(event.value.status),
);

const loadError = ref<string | null>(null);

const load = async () => {
  if (!event.value || !isOrganizer.value) return;
  loadError.value = null;
  try {
    await manage.load(event.value.id);
  } catch (e) {
    loadError.value = errorMessage(e);
  }
};

watch(() => event.value?.id, load, { immediate: true });

const loaded = computed(
  () =>
    !!event.value &&
    manage.eventId === event.value.id &&
    manage.participants !== null &&
    manage.exclusions !== null,
);
</script>

<template>
  <div v-if="event">
    <p v-if="!isOrganizer" class="alert-error" role="alert">
      {{ $t('manage.notOrganizer') }}
    </p>

    <div v-else-if="loadError" class="alert-error" role="alert">
      <p>{{ loadError }}</p>
      <button
        type="button"
        class="mt-2 font-semibold underline underline-offset-2"
        @click="load"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p v-else-if="!loaded" class="text-stone-600" role="status">
      {{ $t('manage.loading') }}
    </p>

    <div v-else-if="manage.participants && manage.exclusions" class="space-y-6">
      <p class="alert-info" data-testid="manage-lifecycle">
        {{ $t(`manage.lifecycle.${event.status}`) }}
      </p>

      <ParticipantsManager
        :participants="manage.participants"
        :membership-open="membershipOpen"
        :my-participant-id="event.myParticipant.id"
      />

      <InvitationsPanel
        v-if="membershipOpen"
        :participants="manage.participants"
      />

      <ExclusionsEditor
        :participants="manage.participants"
        :exclusions="manage.exclusions"
        :editable="membershipOpen"
      />

      <DrawPanel
        v-if="event.status !== 'finished'"
        :event="event"
        :participants="manage.participants"
      />

      <EditEventForm :event="event" />

      <DeleteEventPanel v-if="event.status !== 'finished'" :event="event" />
    </div>
  </div>
</template>
