<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { RouterLink, RouterView, useRoute } from 'vue-router';

import { isApiError } from '@/api';
import EventStatusBadge from '@/components/EventStatusBadge.vue';
import ProfileSwitcher from '@/components/ProfileSwitcher.vue';
import UiIcon from '@/components/UiIcon.vue';
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

// On phones the sections scroll sideways; keep the open one in view.
const sectionNav = ref<HTMLElement | null>(null);
watch(
  () => [route.name, sectionNav.value],
  async () => {
    await nextTick();
    sectionNav.value
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  },
);
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
      class="inline-flex min-h-9 items-center gap-1.5 rounded-sm text-sm font-bold text-pine-700 hover:underline"
    >
      <UiIcon name="arrow-left" class="size-4" /> {{ $t('event.backToEvents') }}
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
        <p class="mt-2 text-stone-700">
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
          ref="sectionNav"
          :aria-label="$t('event.nav.label')"
          class="tab-row -mx-4 mt-6 overflow-x-auto border-b border-ground-line px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
        >
          <ul class="-mb-px flex gap-x-1 max-sm:pr-10">
            <li v-for="section in sections" :key="section.name">
              <RouterLink
                :to="{ name: section.name, params: { eventId: event.id } }"
                class="block border-b-[3px] border-transparent px-3 py-2.5 text-sm font-bold whitespace-nowrap text-stone-700 hover:border-ground-line hover:text-pine-900"
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

<style scoped>
/* More sections lie past the right edge on phones: fade them out there. */
@media (width < 40rem) {
  .tab-row {
    mask-image: linear-gradient(to right, black calc(100% - 3rem), transparent);
  }
}
</style>
