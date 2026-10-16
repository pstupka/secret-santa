<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <section class="card mx-auto max-w-md text-center">
    <h1 class="text-2xl font-bold">{{ $t('notFound.title') }}</h1>
    <p class="mt-3 text-stone-600">{{ $t('notFound.lead') }}</p>
    <RouterLink :to="{ name: 'landing' }" class="btn-secondary mt-6">
      {{ $t('common.backHome') }}
    </RouterLink>
  </section>
</template>
