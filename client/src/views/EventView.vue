<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import { isApiError } from '@/api';
import EventStatusBadge from '@/components/EventStatusBadge.vue';
import ProfileSwitcher from '@/components/ProfileSwitcher.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useExchangeCountdown } from '@/composables/useExchangeCountdown';
import { formatExchangeDate } from '@/events/eventDetails';
import { useEventsStore } from '@/stores/events';

// Layout of every `/events/:eventId/*` page: loads the event into the
// `events` store and shows its header, the caretaker's profile switcher and
// the section nav. Sections read `events.event`, which is set while they
// render.
const route = useRoute();
const events = useEventsStore();
const { t } = useI18n();
const errorMessage = useApiErrorMessage();
const countdownLabel = useExchangeCountdown();

const eventId = computed(() => String(route.params.eventId));
const loading = ref(false);
const error = ref<string | null>(null);

const event = computed(() =>
  events.event?.id === eventId.value ? events.event : null,
);

const load = async () => {
  loading.value = true;
  error.value = null;
  try {
    await events.loadEvent(eventId.value);
  } catch (e) {
    error.value =
      isApiError(e) && e.kind === 'notFound'
        ? t('event.notFound')
        : errorMessage(e);
  } finally {
    loading.value = false;
  }
};

watch(eventId, load, { immediate: true });

const sections = computed(() => {
  if (!event.value) return [];
  const { status, myParticipant } = event.value;
  return [
    { name: 'event', label: 'dashboard' },
    { name: 'event-wishlists', label: 'wishlists' },
    { name: 'event-kids', label: 'kids' },
    { name: 'event-claims', label: 'claims' },
    ...(status === 'open'
      ? []
      : [{ name: 'event-assignment', label: 'assignment' }]),
    ...(myParticipant.role === 'organizer'
      ? [{ name: 'event-manage', label: 'manage' }]
      : []),
  ] as const;
});
</script>

<template>
  <div>
    <RouterLink
      :to="{ name: 'events' }"
      class="inline-flex items-center gap-1 rounded-lg text-sm font-semibold text-pine-700 hover:underline focus-visible:outline-2 focus-visible:outline-pine-600"
    >
      <span aria-hidden="true">←</span> {{ $t('event.backToEvents') }}
    </RouterLink>

    <div v-if="error" class="alert-error mt-6" role="alert">
      <p>{{ error }}</p>
      <button
        type="button"
        class="mt-2 font-semibold underline underline-offset-2"
        @click="load"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p v-else-if="!event" class="mt-6 text-stone-600" role="status">
      {{ $t('event.loading') }}
    </p>

    <template v-else>
      <header class="mt-4">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 class="text-3xl font-bold break-words sm:text-4xl">
            {{ event.title }}
          </h1>
          <EventStatusBadge :status="event.status" />
        </div>
        <p class="mt-2 text-stone-600">
          {{
            $t('events.exchangeOn', {
              date: formatExchangeDate(event.exchangeOn),
            })
          }}
          · {{ countdownLabel(event) }}
        </p>

        <ProfileSwitcher class="mt-5" />
        <p
          v-if="events.actingParticipant && !events.actingParticipant.isSelf"
          class="alert-info mt-3"
          role="status"
        >
          {{
            $t('event.profile.actingAs', {
              name: events.actingParticipant.displayName,
            })
          }}
        </p>

        <nav
          :aria-label="$t('event.nav.label')"
          class="-mx-4 mt-6 overflow-x-auto border-b border-stone-200 px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          <ul class="flex gap-1">
            <li v-for="section in sections" :key="section.name">
              <RouterLink
                :to="{ name: section.name, params: { eventId: event.id } }"
                class="block border-b-2 border-transparent px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-stone-600 hover:text-pine-700"
                exact-active-class="border-cranberry-600! text-pine-900!"
              >
                {{ $t(`event.nav.${section.label}`) }}
              </RouterLink>
            </li>
          </ul>
        </nav>
      </header>

      <div class="mt-6">
        <RouterView />
      </div>
    </template>
  </div>
</template>
