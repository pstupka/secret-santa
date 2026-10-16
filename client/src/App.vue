<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterLink, RouterView, useRouter } from 'vue-router';

import AppLogo from '@/components/AppLogo.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();

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
    <header
      class="sticky top-0 z-10 border-b border-stone-200/70 bg-snow/90 backdrop-blur"
    >
      <div
        class="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4"
      >
        <RouterLink
          :to="{ name: 'landing' }"
          class="rounded-lg focus-visible:outline-2 focus-visible:outline-pine-600"
          :aria-label="$t('nav.home')"
        >
          <AppLogo />
        </RouterLink>
        <nav v-if="auth.isSignedIn" class="flex items-center gap-1 text-sm">
          <RouterLink
            :to="{ name: 'events' }"
            class="rounded-lg px-2.5 py-2 font-semibold whitespace-nowrap text-pine-700 hover:bg-pine-50"
          >
            {{ $t('nav.myEvents') }}
          </RouterLink>
          <button
            type="button"
            class="rounded-lg px-2.5 py-2 whitespace-nowrap text-stone-600 hover:bg-stone-100"
            @click="signOut"
          >
            {{ $t('nav.signOut') }}
          </button>
        </nav>
      </div>
    </header>

    <main class="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
      <RouterView />
    </main>

    <footer class="py-8 text-center text-sm text-stone-500">
      {{ $t('app.name') }} · {{ $t('app.tagline') }}
    </footer>
  </div>
</template>
