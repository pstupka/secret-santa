<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

import { isApiError } from '@/api';
import { magicTokenFromHash, removeHashFromUrl } from '@/auth/personalLink';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const errorMessage = useApiErrorMessage();

const error = ref<string | null>(null);
const missingToken = ref(false);
let magicToken: string | null = null;

const signIn = async () => {
  if (!magicToken) return;
  error.value = null;
  try {
    await auth.signIn(magicToken);
    await router.replace({ name: 'events' });
  } catch (e) {
    // A `401` already signed out and sent the person to the landing page.
    if (!isApiError(e) || e.kind !== 'unauthorized')
      error.value = errorMessage(e);
  }
};

onMounted(() => {
  // Read the personal link's fragment once, then strip it before anything else.
  magicToken = magicTokenFromHash(window.location.hash);
  removeHashFromUrl();
  if (magicToken) signIn();
  else missingToken.value = true;
});
</script>

<template>
  <section class="card mx-auto max-w-md text-center" aria-live="polite">
    <template v-if="missingToken">
      <h1 class="text-2xl font-bold">{{ $t('auth.failed') }}</h1>
      <p class="mt-3 text-stone-600">{{ $t('auth.missingToken') }}</p>
      <RouterLink :to="{ name: 'landing' }" class="btn-secondary mt-6">
        {{ $t('common.backHome') }}
      </RouterLink>
    </template>

    <template v-else-if="error">
      <h1 class="text-2xl font-bold">{{ $t('auth.failed') }}</h1>
      <p class="alert-error mt-4" role="alert">{{ error }}</p>
      <button type="button" class="btn-primary mt-6" @click="signIn">
        {{ $t('common.tryAgain') }}
      </button>
    </template>

    <template v-else>
      <div
        class="mx-auto size-10 animate-spin rounded-full border-4 border-pine-100 border-t-cranberry-600"
        aria-hidden="true"
      />
      <p class="mt-4 font-semibold text-pine-900">{{ $t('auth.signingIn') }}</p>
    </template>
  </section>
</template>
