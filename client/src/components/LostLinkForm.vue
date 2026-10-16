<script setup lang="ts">
import { ref } from 'vue';

import { api } from '@/api';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';

const email = ref('');
const sending = ref(false);
const sent = ref(false);
const error = ref<string | null>(null);
const errorMessage = useApiErrorMessage();

const submit = async () => {
  sending.value = true;
  error.value = null;
  try {
    await api.requestAccessLink(email.value.trim());
    sent.value = true;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <section class="card" aria-labelledby="lost-link-title">
    <h2 id="lost-link-title" class="text-xl font-bold">
      {{ $t('lostLink.title') }}
    </h2>
    <p class="mt-2 text-stone-600">{{ $t('lostLink.lead') }}</p>

    <p v-if="sent" class="alert-info mt-5" role="status">
      {{ $t('lostLink.sent') }}
    </p>
    <form v-else class="mt-5" @submit.prevent="submit">
      <label for="lost-link-email" class="field-label">
        {{ $t('lostLink.emailLabel') }}
      </label>
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          id="lost-link-email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          inputmode="email"
          class="field-input sm:flex-1"
        />
        <button type="submit" class="btn-secondary" :disabled="sending">
          {{ sending ? $t('common.sending') : $t('lostLink.submit') }}
        </button>
      </div>
      <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
    </form>
  </section>
</template>
