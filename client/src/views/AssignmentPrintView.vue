<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, useRoute } from 'vue-router';

import { isApiError } from '@/api';
import {
  actingAsFromQuery,
  loadAssignmentState,
  type AssignmentState,
} from '@/assignment/myAssignment';
import GiftIcon from '@/components/GiftIcon.vue';
import RecipientWishlist from '@/components/RecipientWishlist.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { formatBudget, formatExchangeDate } from '@/events/eventDetails';
import { useEventsStore } from '@/stores/events';

// `/events/:eventId/assignment/print?as=<participantId>`: a print-friendly
// draw result a caretaker hands to their managed participant (or anyone
// prints for themselves). Lives outside the event layout; the app chrome is
// hidden on paper. `?as=` names the managed participant, since the profile
// choice lives only in memory.
const route = useRoute();
const events = useEventsStore();
const { t } = useI18n();
const errorMessage = useApiErrorMessage();

const eventId = computed(() => String(route.params.eventId));
const actingAs = computed(() => actingAsFromQuery(route.query.as));

const state = ref<AssignmentState | null>(null);
// Retrying only helps after a failed request, not for a wrong `?as=`.
const error = ref<{ message: string; canRetry: boolean } | null>(null);

const event = computed(() =>
  events.event?.id === eventId.value ? events.event : null,
);
const acting = computed(() => events.actingParticipant);
const budget = computed(
  () =>
    event.value &&
    formatBudget(event.value.budgetAmount, event.value.budgetCurrency),
);

let latest = 0;
const load = async () => {
  const request = ++latest;
  state.value = null;
  error.value = null;
  try {
    const details = await events.loadEvent(eventId.value);
    if (request !== latest) return;
    if (
      actingAs.value &&
      !details.managedParticipants.some(({ id }) => id === actingAs.value)
    ) {
      // Only the giver or their caretaker may see an assignment (ADR-0005).
      error.value = { message: t('errors.forbidden'), canRetry: false };
      return;
    }
    events.actAs(actingAs.value);
    const next = await loadAssignmentState(details, actingAs.value);
    if (request === latest) state.value = next;
  } catch (e) {
    if (request !== latest) return;
    const notFound = isApiError(e) && e.kind === 'notFound';
    error.value = {
      message: notFound ? t('event.notFound') : errorMessage(e),
      canRetry: !notFound,
    };
  }
};

watch([eventId, actingAs], load, { immediate: true });

const print = () => window.print();
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <RouterLink
        :to="{ name: 'event-assignment', params: { eventId } }"
        class="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-pine-700 hover:underline focus-visible:outline-2 focus-visible:outline-pine-600"
      >
        <span aria-hidden="true">←</span> {{ $t('assignment.print.back') }}
      </RouterLink>
      <button
        v-if="state?.kind === 'assigned'"
        type="button"
        class="btn-primary w-full sm:w-auto"
        data-testid="assignment-print-button"
        @click="print"
      >
        {{ $t('assignment.print.print') }}
      </button>
    </div>

    <div v-if="error" class="alert-error mt-6" role="alert">
      <p>{{ error.message }}</p>
      <button
        v-if="error.canRetry"
        type="button"
        class="mt-2 font-semibold underline underline-offset-2 print:hidden"
        @click="load"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p
      v-else-if="!state || !event || !acting"
      class="mt-6 text-stone-600"
      role="status"
    >
      {{ $t('assignment.loading') }}
    </p>

    <p
      v-else-if="state.kind !== 'assigned'"
      class="card mt-6 text-center text-stone-600"
    >
      <template v-if="state.kind === 'notDrawn'">
        {{ $t('assignment.notDrawn.title') }}
      </template>
      <template v-else-if="acting.isSelf">
        {{ $t('assignment.none.lead') }}
      </template>
      <template v-else>
        {{ $t('assignment.none.managedLead', { name: acting.displayName }) }}
      </template>
    </p>

    <article
      v-else
      class="card mt-6 print:mt-0 print:rounded-none print:border-0 print:p-0 print:shadow-none"
      data-testid="assignment-print-sheet"
    >
      <header
        class="flex items-start justify-between gap-4 border-b border-stone-200 pb-4 print:border-stone-400"
      >
        <div class="min-w-0">
          <p class="text-sm font-semibold text-stone-500">
            {{ $t('app.name') }}
          </p>
          <h1 class="mt-1 text-2xl font-bold break-words sm:text-3xl">
            {{ event.title }}
          </h1>
        </div>
        <GiftIcon class="size-12 shrink-0" />
      </header>

      <div class="py-8 text-center">
        <p class="text-stone-600">
          {{ $t('assignment.print.for', { name: acting.displayName }) }}
        </p>
        <p class="mt-4 text-lg text-stone-700">
          {{ $t('assignment.youGiveTo') }}
        </p>
        <p
          class="mt-2 font-display text-4xl font-bold break-words text-cranberry-600 sm:text-5xl"
          data-testid="assignment-print-recipient"
        >
          {{ state.assignment.recipient.displayName }}
        </p>
        <p class="mt-4 text-sm text-stone-500">
          {{ $t('assignment.keepSecret') }}
        </p>
      </div>

      <dl
        class="grid gap-x-6 gap-y-3 border-y border-stone-200 py-4 sm:grid-cols-2 print:grid-cols-2 print:border-stone-400"
      >
        <div>
          <dt class="text-sm font-semibold text-stone-500">
            {{ $t('assignment.details.exchangeOn') }}
          </dt>
          <dd class="mt-0.5 text-stone-900">
            {{ formatExchangeDate(event.exchangeOn) }}
          </dd>
        </div>
        <div>
          <dt class="text-sm font-semibold text-stone-500">
            {{ $t('assignment.details.budget') }}
          </dt>
          <dd class="mt-0.5 text-stone-900">
            {{ budget ?? $t('assignment.details.noBudget') }}
          </dd>
        </div>
        <div v-if="event.rules" class="sm:col-span-2 print:col-span-2">
          <dt class="text-sm font-semibold text-stone-500">
            {{ $t('assignment.details.rules') }}
          </dt>
          <dd class="mt-0.5 break-words whitespace-pre-line text-stone-900">
            {{ event.rules }}
          </dd>
        </div>
      </dl>

      <section class="pt-5" aria-labelledby="print-wishlist-title">
        <h2 id="print-wishlist-title" class="text-lg font-bold">
          {{
            $t('assignment.wishlist.title', {
              name: state.assignment.recipient.displayName,
            })
          }}
        </h2>
        <RecipientWishlist
          class="mt-2"
          :wishlist="state.assignment.wishlist"
          :recipient-name="state.assignment.recipient.displayName"
        />
      </section>
    </article>
  </div>
</template>
