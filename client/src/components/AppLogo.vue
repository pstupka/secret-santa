<script setup lang="ts">
import GiftIcon from '@/components/GiftIcon.vue';

// `compact` sets the name on two short lines on narrow screens, where the
// signed-in navigation needs the room.
defineProps<{ compact?: boolean }>();
</script>

<template>
  <span class="flex items-center gap-2.5">
    <GiftIcon class="size-8" />
    <span
      class="font-display text-lg font-bold whitespace-nowrap text-white sm:text-xl"
      :class="{
        'max-sm:w-[5.5rem] max-sm:text-sm max-sm:leading-[1.05] max-sm:whitespace-normal':
          compact,
      }"
    >
      {{ $t('app.name') }}
    </span>
  </span>
</template>
