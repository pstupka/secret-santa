<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import ConfirmPanel from '@/components/manage/ConfirmPanel.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { formatBudget, participationAction } from '@/events/eventDetails';
import { useEventsStore } from '@/stores/events';

// `/events/:eventId`: details, participants and decline / rejoin
// for the acting participant. Rendered inside `EventView`, which loads the
// event.
const events = useEventsStore();
const errorMessage = useApiErrorMessage();

const event = computed(() => events.event);
const acting = computed(() => events.actingParticipant);

const budget = computed(
  () =>
    event.value &&
    formatBudget(event.value.budgetAmount, event.value.budgetCurrency),
);
const action = computed(() =>
  event.value && acting.value
    ? participationAction(event.value.status, acting.value)
    : null,
);
const managedIds = computed(
  () => new Set(event.value?.managedParticipants.map(({ id }) => id)),
);

const confirmingDecline = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

// A new profile or event starts without a pending confirmation or error.
watch(
  () => [event.value?.id, acting.value?.id],
  () => {
    confirmingDecline.value = false;
    error.value = null;
  },
);

const run = async (change: () => Promise<unknown>) => {
  saving.value = true;
  error.value = null;
  try {
    await change();
    confirmingDecline.value = false;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
};
const decline = () => run(events.decline);
const rejoin = () => run(events.rejoin);
</script>

<template>
  <div v-if="event && acting" class="space-y-6">
    <article class="card" aria-labelledby="details-title">
      <div
        v-if="event.status !== 'open' && acting.status === 'active'"
        class="mb-8 border-b border-dashed border-kraft-400 pb-8"
      >
        <RouterLink
          :to="{ name: 'event-assignment', params: { eventId: event.id } }"
          class="btn-primary w-full whitespace-nowrap sm:w-auto"
        >
          {{ $t('dashboard.participation.seeAssignment') }}
        </RouterLink>
      </div>

      <section aria-labelledby="details-title">
        <h2 id="details-title" class="text-lg font-bold">
          {{ $t('dashboard.details.title') }}
        </h2>
        <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-bold text-stone-600">
              {{ $t('dashboard.details.budget') }}
            </dt>
            <dd class="mt-0.5 text-stone-800">
              {{ budget ?? $t('dashboard.details.noBudget') }}
            </dd>
          </div>
          <div v-if="event.description" class="sm:col-span-2">
            <dt class="text-sm font-bold text-stone-600">
              {{ $t('dashboard.details.description') }}
            </dt>
            <dd class="mt-0.5 break-words whitespace-pre-line text-stone-800">
              {{ event.description }}
            </dd>
          </div>
          <div v-if="event.rules" class="sm:col-span-2">
            <dt class="text-sm font-bold text-stone-600">
              {{ $t('dashboard.details.rules') }}
            </dt>
            <dd class="mt-0.5 break-words whitespace-pre-line text-stone-800">
              {{ event.rules }}
            </dd>
          </div>
        </dl>
        <p class="field-hint mt-4">
          {{ $t('dashboard.details.timezone', { timezone: event.timezone }) }}
        </p>
      </section>

      <section
        class="sheet-rule mt-8 pt-8"
        aria-labelledby="participation-title"
      >
        <h2 id="participation-title" class="text-lg font-bold">
          {{ $t('dashboard.participation.title') }}
        </h2>
        <p class="mt-2 text-stone-700">
          <template v-if="acting.role === 'organizer'">
            {{ $t('dashboard.participation.organizer') }}
          </template>
          <template v-else-if="acting.isSelf">
            {{ $t(`dashboard.participation.${acting.status}`) }}
          </template>
          <template v-else-if="acting.status === 'active'">
            {{
              $t('dashboard.participation.managedActive', {
                name: acting.displayName,
              })
            }}
          </template>
          <template v-else>
            {{
              $t('dashboard.participation.managedDeclined', {
                name: acting.displayName,
              })
            }}
          </template>
        </p>
        <p
          v-if="acting.role !== 'organizer'"
          class="mt-1 text-sm text-stone-600"
        >
          <template v-if="event.status === 'finished'">
            {{ $t('dashboard.participation.finished') }}
          </template>
          <template v-else-if="event.status === 'drawn'">
            {{ $t('dashboard.participation.locked') }}
          </template>
          <template v-else-if="action">
            {{ $t('dashboard.participation.canChangeUntilDraw') }}
          </template>
        </p>

        <div v-if="action === 'decline'" class="mt-4">
          <ConfirmPanel
            v-if="confirmingDecline"
            :message="
              acting.isSelf
                ? $t('dashboard.participation.confirmDecline')
                : $t('dashboard.participation.managedConfirmDecline', {
                    name: acting.displayName,
                  })
            "
            :confirm-label="$t('dashboard.participation.confirm')"
            :busy-label="$t('dashboard.participation.saving')"
            :busy="saving"
            @confirm="decline"
            @cancel="confirmingDecline = false"
          />
          <button
            v-else
            type="button"
            class="btn-secondary w-full sm:w-auto"
            @click="confirmingDecline = true"
          >
            {{
              acting.isSelf
                ? $t('dashboard.participation.decline')
                : $t('dashboard.participation.managedDecline')
            }}
          </button>
        </div>

        <button
          v-else-if="action === 'rejoin'"
          type="button"
          class="btn-primary mt-4 w-full sm:w-auto"
          :disabled="saving"
          @click="rejoin"
        >
          {{
            saving
              ? $t('dashboard.participation.saving')
              : acting.isSelf
              ? $t('dashboard.participation.rejoin')
              : $t('dashboard.participation.managedRejoin')
          }}
        </button>

        <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
      </section>
    </article>

    <section class="card" aria-labelledby="participants-title">
      <h2 id="participants-title" class="text-lg font-bold">
        {{
          $t('dashboard.participants.title', {
            count: event.participants.length,
          })
        }}
      </h2>
      <ul class="mt-3 divide-y divide-dashed divide-kraft-400">
        <li
          v-for="participant in event.participants"
          :key="participant.id"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 py-3"
        >
          <span
            class="font-bold"
            :class="
              participant.status === 'declined'
                ? 'text-stone-600 line-through decoration-stone-400'
                : 'text-stone-800'
            "
          >
            {{ participant.displayName }}
          </span>
          <span
            v-if="participant.id === event.myParticipant.id"
            class="stamp border-pine-600/40 text-pine-700"
          >
            {{ $t('dashboard.participants.you') }}
          </span>
          <span
            v-if="participant.role === 'organizer'"
            class="stamp border-cranberry-600/40 text-cranberry-700"
          >
            {{ $t('event.role.organizer') }}
          </span>
          <span
            v-if="managedIds.has(participant.id)"
            class="stamp border-kraft-600/50 text-kraft-600"
          >
            {{ $t('dashboard.participants.managed') }}
          </span>
          <span
            v-if="participant.status === 'declined'"
            class="text-sm text-stone-600"
          >
            {{ $t('dashboard.participants.declined') }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
