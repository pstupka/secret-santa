<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import EventStatusBadge from '@/components/EventStatusBadge.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useExchangeCountdown } from '@/composables/useExchangeCountdown';
import { formatExchangeDate } from '@/events/eventDetails';
import { useAuthStore } from '@/stores/auth';
import { useEventsStore } from '@/stores/events';

const auth = useAuthStore();
const events = useEventsStore();
const countdownLabel = useExchangeCountdown();
const errorMessage = useApiErrorMessage();

const loading = ref(false);
const error = ref<string | null>(null);

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await events.loadMyEvents();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<template>
  <div>
    <h1 class="text-3xl font-bold sm:text-4xl">{{ $t('events.title') }}</h1>
    <p v-if="auth.me" class="mt-2 text-stone-600">
      {{ $t('events.signedInAs', { email: auth.me.email }) }}
    </p>

    <div v-if="error" class="alert-error mt-8" role="alert">
      <p>{{ error }}</p>
      <button
        type="button"
        class="mt-2 font-semibold underline underline-offset-2"
        @click="load"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p
      v-else-if="loading && !events.myEvents"
      class="mt-8 text-stone-600"
      role="status"
    >
      {{ $t('events.loading') }}
    </p>

    <section
      v-else-if="events.myEvents && events.myEvents.length === 0"
      class="card mt-8 text-center"
    >
      <p class="text-lg font-semibold text-pine-900">
        {{ $t('events.empty') }}
      </p>
      <p class="mt-2 text-stone-600">{{ $t('events.emptyLead') }}</p>
    </section>

    <ul v-else-if="events.myEvents" class="mt-8 space-y-4">
      <li v-for="event in events.myEvents" :key="event.id">
        <RouterLink
          :to="{ name: 'event', params: { eventId: event.id } }"
          class="card block transition hover:-translate-y-0.5"
          :class="{ 'opacity-75': event.status === 'finished' }"
        >
          <div class="flex items-start justify-between gap-3">
            <h2 class="text-xl font-bold break-words">{{ event.title }}</h2>
            <EventStatusBadge :status="event.status" class="mt-1 shrink-0" />
          </div>
          <p class="mt-2 text-stone-700">
            {{
              $t('events.exchangeOn', {
                date: formatExchangeDate(event.exchangeOn),
              })
            }}
            <span class="whitespace-nowrap text-stone-600">
              · {{ countdownLabel(event) }}
            </span>
          </p>
          <p class="mt-3 flex flex-wrap gap-2">
            <span
              class="stamp"
              :class="
                event.myParticipant.role === 'organizer'
                  ? 'border-cranberry-600/40 text-cranberry-700'
                  : 'border-stone-400 text-stone-700'
              "
            >
              {{ $t(`event.role.${event.myParticipant.role}`) }}
            </span>
            <span
              v-if="event.myParticipant.status === 'declined'"
              class="stamp border-dashed border-stone-500 text-stone-700"
            >
              {{ $t('events.declined') }}
            </span>
          </p>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>
