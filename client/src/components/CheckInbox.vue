<script setup lang="ts">
defineProps<{
  // Where the personal link was sent.
  email: string;
  // Set when the organizer has just created this event.
  eventTitle?: string;
}>();
</script>

<template>
  <section class="card text-center" aria-live="polite">
    <div
      class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-pine-50"
    >
      <svg
        viewBox="0 0 24 24"
        class="size-8 text-pine-600"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    </div>
    <h2 class="text-2xl font-bold">{{ $t('checkInbox.title') }}</h2>
    <p class="mt-3 text-stone-700">
      {{ $t('checkInbox.lead', { email }) }}
    </p>
    <p v-if="eventTitle" class="mt-2 text-stone-700">
      {{ $t('checkInbox.eventCreated', { title: eventTitle }) }}
    </p>
    <ul
      class="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-stone-600"
    >
      <li class="alert-info">{{ $t('checkInbox.spam') }}</li>
      <li class="alert-info">{{ $t('checkInbox.keepSecret') }}</li>
    </ul>
  </section>
</template>
