<script setup lang="ts">
import GiftIcon from '@/components/GiftIcon.vue';
</script>

<template>
  <span class="flex items-center gap-2.5">
    <GiftIcon class="size-8" />
    <span
      class="font-display text-lg font-bold whitespace-nowrap text-pine-900 sm:text-xl"
    >
      {{ $t('app.name') }}
    </span>
  </span>
</template>
