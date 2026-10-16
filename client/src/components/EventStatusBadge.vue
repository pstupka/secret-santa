<script setup lang="ts">
import type { EventStatus } from '@/api';

defineProps<{ status: EventStatus }>();

const styles: Record<EventStatus, string> = {
  open: 'bg-pine-50 text-pine-700 ring-pine-600/20',
  drawn: 'bg-gold-300/40 text-pine-900 ring-gold-400/60',
  finished: 'bg-stone-100 text-stone-600 ring-stone-300',
};
</script>

<template>
  <span
    class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset"
    :class="styles[status]"
  >
    {{ $t(`event.status.${status}`) }}
  </span>
</template>
