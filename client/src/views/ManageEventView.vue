<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import UiIcon from '@/components/UiIcon.vue';
import DeleteEventPanel from '@/components/manage/DeleteEventPanel.vue';
import DrawPanel from '@/components/manage/DrawPanel.vue';
import EditEventForm from '@/components/manage/EditEventForm.vue';
import ExclusionsEditor from '@/components/manage/ExclusionsEditor.vue';
import InvitationsPanel from '@/components/manage/InvitationsPanel.vue';
import ParticipantsManager from '@/components/manage/ParticipantsManager.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { isMembershipOpen } from '@/manage/participants';
import { currentStep, MANAGE_STEPS, stepState } from '@/manage/steps';
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

const current = computed(() =>
  event.value && manage.participants
    ? currentStep(event.value.status, manage.participants)
    : null,
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
      <nav :aria-label="$t('manage.steps.label')">
        <ol class="grid grid-cols-3 gap-2" data-testid="manage-steps">
          <li v-for="(step, index) in MANAGE_STEPS" :key="step">
            <a
              :href="`#manage-${step}`"
              class="block text-sm leading-snug"
              :class="{
                'text-pine-900': stepState(step, current) === 'done',
                'font-bold text-cranberry-700':
                  stepState(step, current) === 'current',
                'text-stone-700': stepState(step, current) === 'upcoming',
              }"
              :aria-current="
                stepState(step, current) === 'current' ? 'step' : undefined
              "
            >
              <span
                class="mb-2 block h-1"
                :class="{
                  'bg-pine-700': stepState(step, current) === 'done',
                  'bg-cranberry-600': stepState(step, current) === 'current',
                  'bg-ground-line': stepState(step, current) === 'upcoming',
                }"
                aria-hidden="true"
              />
              <span class="font-display font-bold">{{ index + 1 }}.</span>
              {{ $t(`manage.steps.${step}`) }}
              <span v-if="stepState(step, current) === 'done'" class="sr-only">
                – {{ $t('manage.steps.done') }}
              </span>
            </a>
          </li>
        </ol>
        <p class="mt-4 text-stone-800" data-testid="manage-lifecycle">
          {{ $t(`manage.lifecycle.${event.status}`) }}
        </p>
      </nav>

      <div id="manage-participants" class="scroll-mt-6">
        <ParticipantsManager
          :participants="manage.participants"
          :membership-open="membershipOpen"
          :my-participant-id="event.myParticipant.id"
        />
      </div>

      <div v-if="membershipOpen" id="manage-invitations" class="scroll-mt-6">
        <InvitationsPanel :participants="manage.participants" />
      </div>

      <details
        class="group"
        :open="manage.exclusions.some(({ builtIn }) => !builtIn) || undefined"
        data-testid="exclusions-disclosure"
      >
        <summary
          class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm font-bold text-pine-900 [&::-webkit-details-marker]:hidden"
        >
          <UiIcon
            name="chevron"
            class="size-4 shrink-0 transition-transform group-open:rotate-90"
          />
          {{ $t('manage.exclusions.disclosure') }}
        </summary>
        <ExclusionsEditor
          class="mt-3"
          :participants="manage.participants"
          :exclusions="manage.exclusions"
          :editable="membershipOpen"
          :titled="false"
        />
      </details>

      <div id="manage-draw" class="scroll-mt-6">
        <DrawPanel
          v-if="event.status !== 'finished'"
          :event="event"
          :participants="manage.participants"
        />
      </div>

      <details class="group" data-testid="settings-disclosure">
        <summary
          class="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm font-bold text-pine-900 [&::-webkit-details-marker]:hidden"
        >
          <UiIcon
            name="chevron"
            class="size-4 shrink-0 transition-transform group-open:rotate-90"
          />
          {{ $t('manage.settings') }}
        </summary>
        <div class="mt-3 space-y-6">
          <EditEventForm :event="event" />
          <DeleteEventPanel v-if="event.status !== 'finished'" :event="event" />
        </div>
      </details>
    </div>
  </div>
</template>
