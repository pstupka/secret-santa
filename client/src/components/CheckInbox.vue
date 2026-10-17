<script setup lang="ts">
defineProps<{
  // Where the personal link was sent.
  email: string;
  // Set when the organizer has just created this event.
  eventTitle?: string;
}>();
</script>

<template>
  <section class="card" aria-live="polite">
    <div class="flex flex-col gap-6 sm:flex-row sm:items-start">
      <div
        class="relative aspect-[3/2] w-32 shrink-0 rounded-sm bg-paper shadow-paper ring-1 ring-kraft-300"
        aria-hidden="true"
      >
        <svg
          class="absolute inset-0 size-full"
          viewBox="0 0 120 80"
          fill="none"
          focusable="false"
        >
          <path
            d="M2 2 60 46 118 2"
            class="stroke-kraft-400"
            stroke-width="1.5"
          />
        </svg>
        <span
          class="absolute top-[57%] left-1/2 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cranberry-600 ring-4 ring-cranberry-700/30"
        />
      </div>
      <div class="min-w-0">
        <h2 class="text-3xl font-bold">{{ $t('checkInbox.title') }}</h2>
        <p class="mt-3 text-lg text-stone-800">
          {{ $t('checkInbox.lead', { email }) }}
        </p>
        <p v-if="eventTitle" class="mt-2 text-stone-700">
          {{ $t('checkInbox.eventCreated', { title: eventTitle }) }}
        </p>
      </div>
    </div>
    <div class="sheet-rule mt-8 space-y-3 pt-6 text-sm">
      <p class="font-bold text-cranberry-700">
        {{ $t('checkInbox.keepSecret') }}
      </p>
      <p class="text-stone-600">{{ $t('checkInbox.spam') }}</p>
    </div>
  </section>
</template>
