<script setup lang="ts">
// The few line icons the interface needs, drawn in one 2px stroke.
defineProps<{ name: 'chevron' | 'arrow-left' | 'pair' }>();
</script>

<template>
  <svg
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-if="name === 'chevron'" d="m6 3 5 5-5 5" />
    <path v-else-if="name === 'arrow-left'" d="M13 8H3m4-4L3 8l4 4" />
    <path v-else d="M2 8h12M5 5 2 8l3 3m6-6 3 3-3 3" />
  </svg>
</template>
