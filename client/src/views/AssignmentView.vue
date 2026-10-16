<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { printLocation } from '@/assignment/myAssignment';
import { useMyAssignment } from '@/assignment/useMyAssignment';
import GiftIcon from '@/components/GiftIcon.vue';
import RecipientWishlist from '@/components/RecipientWishlist.vue';
import { formatBudget, formatExchangeDate } from '@/events/eventDetails';
import { useEventsStore } from '@/stores/events';

// `/events/:eventId/assignment`: whom the acting participant (oneself or a
// managed participant) gives a gift to, and the recipient's wishlist.
// Rendered inside `EventView`, which loads the event.
const events = useEventsStore();
const { state, error, reload } = useMyAssignment();

const event = computed(() => events.event);
const acting = computed(() => events.actingParticipant);
const budget = computed(
  () =>
    event.value &&
    formatBudget(event.value.budgetAmount, event.value.budgetCurrency),
);
</script>

<template>
  <div v-if="event && acting">
    <div v-if="error" class="alert-error" role="alert">
      <p>{{ error }}</p>
      <button
        type="button"
        class="mt-2 font-semibold underline underline-offset-2"
        @click="reload"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p v-else-if="!state" class="text-stone-600" role="status">
      {{ $t('assignment.loading') }}
    </p>

    <section
      v-else-if="state.kind === 'notDrawn'"
      class="card text-center"
      data-testid="assignment-not-drawn"
    >
      <GiftIcon class="mx-auto size-14" />
      <h2 class="mt-4 text-xl font-bold">
        {{ $t('assignment.notDrawn.title') }}
      </h2>
      <p class="mx-auto mt-2 max-w-md text-stone-600">
        {{
          acting.isSelf
            ? $t('assignment.notDrawn.lead')
            : $t('assignment.notDrawn.managedLead', {
                name: acting.displayName,
              })
        }}
      </p>
      <RouterLink
        :to="{ name: 'event-wishlists', params: { eventId: event.id } }"
        class="btn-secondary mt-5"
      >
        {{ $t('assignment.notDrawn.toWishlists') }}
      </RouterLink>
    </section>

    <section
      v-else-if="state.kind === 'none'"
      class="card text-center"
      data-testid="assignment-none"
    >
      <h2 class="text-xl font-bold">{{ $t('assignment.none.title') }}</h2>
      <p class="mx-auto mt-2 max-w-md text-stone-600">
        {{
          acting.isSelf
            ? $t('assignment.none.lead')
            : $t('assignment.none.managedLead', { name: acting.displayName })
        }}
      </p>
    </section>

    <div v-else class="space-y-6">
      <section
        class="relative overflow-hidden rounded-2xl bg-pine-900 px-6 py-8 text-center text-white shadow-sm"
        aria-labelledby="recipient-intro"
      >
        <div
          class="snowfall pointer-events-none absolute inset-0 opacity-20"
          aria-hidden="true"
        />
        <p id="recipient-intro" class="relative text-pine-100">
          {{
            acting.isSelf
              ? $t('assignment.youGiveTo')
              : $t('assignment.managedGivesTo', { name: acting.displayName })
          }}
        </p>
        <p
          class="relative mt-2 font-display text-4xl font-bold break-words text-gold-300 sm:text-5xl"
          data-testid="assignment-recipient"
        >
          {{ state.assignment.recipient.displayName }}
        </p>
        <p class="relative mt-4 text-sm text-pine-100">
          {{ $t('assignment.keepSecret') }}
        </p>
      </section>

      <p v-if="event.status === 'finished'" class="alert-info" role="status">
        {{ $t('assignment.finished') }}
      </p>

      <section class="card" aria-labelledby="gift-details-title">
        <h2 id="gift-details-title" class="text-lg font-bold">
          {{ $t('assignment.details.title') }}
        </h2>
        <dl class="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <div>
            <dt class="text-sm font-semibold text-stone-500">
              {{ $t('assignment.details.exchangeOn') }}
            </dt>
            <dd class="mt-0.5 text-stone-800">
              {{ formatExchangeDate(event.exchangeOn) }}
            </dd>
          </div>
          <div>
            <dt class="text-sm font-semibold text-stone-500">
              {{ $t('assignment.details.budget') }}
            </dt>
            <dd class="mt-0.5 text-stone-800">
              {{ budget ?? $t('assignment.details.noBudget') }}
            </dd>
          </div>
          <div v-if="event.rules" class="sm:col-span-2">
            <dt class="text-sm font-semibold text-stone-500">
              {{ $t('assignment.details.rules') }}
            </dt>
            <dd class="mt-0.5 break-words whitespace-pre-line text-stone-800">
              {{ event.rules }}
            </dd>
          </div>
        </dl>
      </section>

      <section class="card" aria-labelledby="recipient-wishlist-title">
        <h2 id="recipient-wishlist-title" class="text-lg font-bold">
          {{
            $t('assignment.wishlist.title', {
              name: state.assignment.recipient.displayName,
            })
          }}
        </h2>
        <RecipientWishlist
          class="mt-3"
          :wishlist="state.assignment.wishlist"
          :recipient-name="state.assignment.recipient.displayName"
        />
      </section>

      <section class="card" aria-labelledby="print-title">
        <h2 id="print-title" class="text-lg font-bold">
          {{ $t('assignment.print.title') }}
        </h2>
        <p class="mt-2 text-stone-600">
          {{
            acting.isSelf
              ? $t('assignment.print.lead')
              : $t('assignment.print.managedLead', {
                  name: acting.displayName,
                })
          }}
        </p>
        <RouterLink
          :to="printLocation(event.id, events.actingAs)"
          class="btn-secondary mt-4 w-full sm:w-auto"
          data-testid="assignment-print-link"
        >
          {{ $t('assignment.print.open') }}
        </RouterLink>
      </section>
    </div>
  </div>
</template>
