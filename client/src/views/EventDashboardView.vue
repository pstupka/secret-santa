<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import {
  exchangeCountdown,
  formatBudget,
  formatExchangeDate,
  participationAction,
} from '@/events/eventDetails';
import { useEventsStore } from '@/stores/events';

// `/events/:eventId`: details, countdown, participants and decline / rejoin
// for the acting participant. Rendered inside `EventView`, which loads the
// event.
const events = useEventsStore();
const errorMessage = useApiErrorMessage();

const event = computed(() => events.event);
const acting = computed(() => events.actingParticipant);

const countdown = computed(
  () =>
    event.value &&
    exchangeCountdown(event.value.exchangeOn, event.value.timezone),
);
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
    <section
      class="relative overflow-hidden rounded-2xl bg-pine-900 px-6 py-7 text-center text-white shadow-sm"
      aria-live="polite"
    >
      <div
        class="snowfall pointer-events-none absolute inset-0 opacity-20"
        aria-hidden="true"
      />
      <p v-if="countdown?.kind === 'days'" class="relative">
        <span class="block font-display text-5xl font-bold text-gold-300">
          {{ countdown.days }}
        </span>
        <span class="mt-1 block text-pine-100">
          {{ $t('dashboard.countdown.days') }}
        </span>
      </p>
      <p v-else-if="countdown" class="relative font-display text-2xl font-bold">
        {{ $t(`dashboard.countdown.${countdown.kind}`) }}
      </p>
      <p class="relative mt-2 text-sm text-pine-100">
        {{ formatExchangeDate(event.exchangeOn) }}
      </p>
    </section>

    <section class="card" aria-labelledby="participation-title">
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
      <p class="mt-1 text-sm text-stone-500">
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

      <RouterLink
        v-if="event.status !== 'open' && acting.status === 'active'"
        :to="{ name: 'event-assignment', params: { eventId: event.id } }"
        class="btn-primary mt-4 w-full sm:w-auto"
      >
        {{ $t('dashboard.participation.seeAssignment') }}
      </RouterLink>

      <div v-if="action === 'decline'" class="mt-4">
        <div v-if="confirmingDecline" class="alert-error space-y-3">
          <p>
            {{
              acting.isSelf
                ? $t('dashboard.participation.confirmDecline')
                : $t('dashboard.participation.managedConfirmDecline', {
                    name: acting.displayName,
                  })
            }}
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              class="btn-primary"
              :disabled="saving"
              @click="decline"
            >
              {{
                saving
                  ? $t('dashboard.participation.saving')
                  : $t('dashboard.participation.confirm')
              }}
            </button>
            <button
              type="button"
              class="btn-secondary"
              :disabled="saving"
              @click="confirmingDecline = false"
            >
              {{ $t('dashboard.participation.cancel') }}
            </button>
          </div>
        </div>
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

    <section class="card" aria-labelledby="details-title">
      <h2 id="details-title" class="text-lg font-bold">
        {{ $t('dashboard.details.title') }}
      </h2>
      <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <div>
          <dt class="text-sm font-semibold text-stone-500">
            {{ $t('dashboard.details.exchangeOn') }}
          </dt>
          <dd class="mt-0.5 text-stone-800">
            {{ formatExchangeDate(event.exchangeOn) }}
          </dd>
        </div>
        <div>
          <dt class="text-sm font-semibold text-stone-500">
            {{ $t('dashboard.details.budget') }}
          </dt>
          <dd class="mt-0.5 text-stone-800">
            {{ budget ?? $t('dashboard.details.noBudget') }}
          </dd>
        </div>
        <div v-if="event.description" class="sm:col-span-2">
          <dt class="text-sm font-semibold text-stone-500">
            {{ $t('dashboard.details.description') }}
          </dt>
          <dd class="mt-0.5 break-words whitespace-pre-line text-stone-800">
            {{ event.description }}
          </dd>
        </div>
        <div v-if="event.rules" class="sm:col-span-2">
          <dt class="text-sm font-semibold text-stone-500">
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

    <section class="card" aria-labelledby="participants-title">
      <h2 id="participants-title" class="text-lg font-bold">
        {{
          $t('dashboard.participants.title', {
            count: event.participants.length,
          })
        }}
      </h2>
      <ul class="mt-3 divide-y divide-stone-100">
        <li
          v-for="participant in event.participants"
          :key="participant.id"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 py-2.5"
        >
          <span
            class="font-medium"
            :class="
              participant.status === 'declined'
                ? 'text-stone-400 line-through'
                : 'text-stone-800'
            "
          >
            {{ participant.displayName }}
          </span>
          <span
            v-if="participant.id === event.myParticipant.id"
            class="rounded-full bg-pine-50 px-2 py-0.5 text-xs font-semibold text-pine-700"
          >
            {{ $t('dashboard.participants.you') }}
          </span>
          <span
            v-if="participant.role === 'organizer'"
            class="rounded-full bg-cranberry-50 px-2 py-0.5 text-xs font-semibold text-cranberry-700"
          >
            {{ $t('event.role.organizer') }}
          </span>
          <span
            v-if="managedIds.has(participant.id)"
            class="rounded-full bg-gold-300/40 px-2 py-0.5 text-xs font-semibold text-pine-900"
          >
            {{ $t('dashboard.participants.managed') }}
          </span>
          <span
            v-if="participant.status === 'declined'"
            class="text-xs text-stone-500"
          >
            {{ $t('dashboard.participants.declined') }}
          </span>
        </li>
      </ul>
    </section>
  </div>
</template>
