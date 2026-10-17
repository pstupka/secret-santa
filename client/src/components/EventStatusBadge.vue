<script setup lang="ts">
import type { EventStatus } from '@/api';

defineProps<{ status: EventStatus }>();

const styles: Record<EventStatus, string> = {
  open: 'border-pine-700 text-pine-700',
  drawn: 'border-cranberry-700 text-cranberry-700',
  finished: 'border-stone-600 text-stone-700',
};
</script>

<template>
  <span class="stamp bg-paper" :class="styles[status]">
    {{ $t(`event.status.${status}`) }}
  </span>
</template>
