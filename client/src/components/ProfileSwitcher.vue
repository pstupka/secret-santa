<script setup lang="ts">
import { computed } from 'vue';

import { useEventsStore } from '@/stores/events';

// Caretaker's profile switcher: act as oneself or as one of one's managed
// participants in the current event. Requests made through
// `events.actingAs` / `events.requestHeaders` follow the choice.
const events = useEventsStore();

const profiles = computed(() => {
  const event = events.event;
  if (!event) return [];
  return [
    { id: null, label: null },
    ...event.managedParticipants.map(({ id, displayName }) => ({
      id,
      label: displayName,
    })),
  ];
});
</script>

<template>
  <div
    v-if="profiles.length > 1"
    role="radiogroup"
    :aria-label="$t('event.profile.label')"
    class="flex flex-wrap items-center gap-2"
  >
    <span class="text-sm font-semibold text-stone-600" aria-hidden="true">
      {{ $t('event.profile.label') }}:
    </span>
    <button
      v-for="profile in profiles"
      :key="profile.id ?? 'self'"
      type="button"
      role="radio"
      :aria-checked="events.actingAs === profile.id"
      class="min-h-9 rounded-full border px-3.5 py-1 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine-600"
      :class="
        events.actingAs === profile.id
          ? 'border-pine-700 bg-pine-700 text-white'
          : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'
      "
      @click="events.actAs(profile.id)"
    >
      {{ profile.label ?? $t('event.profile.self') }}
    </button>
  </div>
</template>
