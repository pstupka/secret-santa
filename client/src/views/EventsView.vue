<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';

// Placeholder until "my events" lands (#13).
const auth = useAuthStore();
</script>

<template>
  <h1 class="text-3xl font-bold sm:text-4xl">{{ $t('events.title') }}</h1>
  <p v-if="auth.me" class="mt-2 text-stone-600">
    {{ $t('events.signedInAs', { email: auth.me.email }) }}
  </p>
  <p class="card mt-8 text-center text-stone-600">
    {{ $t('events.comingSoon') }}
  </p>
</template>
