<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { OrganizerParticipant } from '@/api';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { pendingInvitees } from '@/manage/participants';
import { useManageStore } from '@/stores/manage';

// Bulk "send invitations": to everyone not invited yet; never re-sends.
const props = defineProps<{ participants: OrganizerParticipant[] }>();

const manage = useManageStore();
const errorMessage = useApiErrorMessage();
const { t } = useI18n();

const pendingCount = computed(() => pendingInvitees(props.participants).length);
const sending = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const send = async () => {
  sending.value = true;
  error.value = null;
  notice.value = null;
  try {
    const sent = await manage.sendPendingInvitations();
    notice.value = t('manage.invitations.sent', { count: sent });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    sending.value = false;
  }
};
</script>

<template>
  <section class="card" aria-labelledby="manage-invitations-title">
    <h2 id="manage-invitations-title" class="text-lg font-bold">
      {{ $t('manage.invitations.title') }}
    </h2>
    <p class="mt-2 text-sm text-stone-600">
      {{ $t('manage.invitations.lead') }}
    </p>

    <p v-if="pendingCount === 0" class="mt-3 text-sm text-stone-600">
      {{ $t('manage.invitations.nonePending') }}
    </p>
    <button
      v-else
      type="button"
      class="btn-primary mt-4 w-full sm:w-auto"
      :disabled="sending"
      data-testid="send-invitations"
      :data-pending-count="pendingCount"
      @click="send"
    >
      {{
        sending
          ? $t('manage.invitations.sending')
          : $t('manage.invitations.send', { count: pendingCount })
      }}
    </button>

    <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert-info mt-3" role="status">
      {{ notice }}
    </p>
  </section>
</template>
