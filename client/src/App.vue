<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';

import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const frame = computed(() => (route.meta.wide ? 'max-w-5xl' : 'max-w-3xl'));

onMounted(() => {
  // Validate a stored magic token on start; a `401` signs out via the api client.
  if (auth.isSignedIn && !auth.me) auth.loadMe().catch(() => undefined);
});

const signOut = async () => {
  auth.signOut();
  await router.push({ name: 'landing' });
};
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <header class="bg-pine-900 text-white print:hidden">
      <div
        class="mx-auto flex h-16 items-center justify-between gap-2 px-4"
        :class="frame"
      >
        <RouterLink
          :to="{ name: 'landing' }"
          class="rounded-sm focus-visible:outline-gold-300"
          :aria-label="$t('nav.home')"
        >
          <AppLogo :compact="auth.isSignedIn" />
        </RouterLink>
        <nav v-if="auth.isSignedIn" class="flex items-center gap-1 text-sm">
          <RouterLink
            :to="{ name: 'events' }"
            class="rounded-sm px-2.5 py-2 font-bold whitespace-nowrap text-white underline-offset-4 hover:underline focus-visible:outline-gold-300"
          >
            {{ $t('nav.myEvents') }}
          </RouterLink>
          <button
            type="button"
            class="rounded-sm px-2.5 py-2 whitespace-nowrap text-pine-100 underline-offset-4 hover:underline focus-visible:outline-gold-300"
            @click="signOut"
          >
            {{ $t('nav.signOut') }}
          </button>
        </nav>
      </div>
    </header>

    <main
      class="mx-auto w-full flex-1 px-4 py-8 sm:py-12 print:max-w-none print:p-0"
      :class="frame"
    >
      <RouterView />
    </main>

    <footer class="py-8 text-center text-sm text-stone-700 print:hidden">
      {{ $t('app.name') }} · {{ $t('app.tagline') }}
    </footer>
  </div>
</template>
