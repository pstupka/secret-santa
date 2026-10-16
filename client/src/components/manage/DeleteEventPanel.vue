<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';

import type { Event } from '@/api';
import ConfirmPanel from '@/components/manage/ConfirmPanel.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useManageStore } from '@/stores/manage';

// Deletes the event with all its data, after a confirmation; then back to
// "my events". Not offered once the event is finished.
defineProps<{ event: Event }>();

const manage = useManageStore();
const router = useRouter();
const errorMessage = useApiErrorMessage();

const confirming = ref(false);
const deleting = ref(false);
const error = ref<string | null>(null);

const remove = async () => {
  deleting.value = true;
  error.value = null;
  try {
    await manage.deleteEvent();
    await router.replace({ name: 'events' });
  } catch (e) {
    error.value = errorMessage(e);
    deleting.value = false;
  }
};
</script>

<template>
  <section
    class="card border-cranberry-200"
    aria-labelledby="manage-delete-title"
  >
    <h2 id="manage-delete-title" class="text-lg font-bold">
      {{ $t('manage.delete.title') }}
    </h2>
    <p class="mt-2 text-sm text-stone-600">{{ $t('manage.delete.lead') }}</p>

    <ConfirmPanel
      v-if="confirming"
      class="mt-4"
      :message="$t('manage.delete.confirm', { title: event.title })"
      :confirm-label="$t('manage.delete.confirmYes')"
      :busy-label="$t('manage.delete.deleting')"
      :busy="deleting"
      confirm-testid="confirm-delete-event"
      @confirm="remove"
      @cancel="confirming = false"
    />
    <button
      v-else
      type="button"
      class="btn mt-4 w-full border border-cranberry-200 bg-white text-cranberry-700 hover:bg-cranberry-50 focus-visible:outline-cranberry-600 sm:w-auto"
      data-testid="delete-event"
      @click="confirming = true"
    >
      {{ $t('manage.delete.submit') }}
    </button>

    <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
  </section>
</template>
