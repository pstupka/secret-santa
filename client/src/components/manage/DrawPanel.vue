<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Event, OrganizerParticipant } from '@/api';
import ConfirmPanel from '@/components/manage/ConfirmPanel.vue';
import {
  drawAction,
  drawBlockers,
  drawFailure,
  formatDrawnAt,
  type DrawBlocker,
  type DrawFailure,
} from '@/manage/draw';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useManageStore } from '@/stores/manage';

// Runs the draw, or redoes it before the exchange date. Explains up front
// what blocks it (the server's `422` reasons) and confirms before running:
// everyone gets an email, and a redo replaces every pair.
const props = defineProps<{
  event: Event;
  participants: OrganizerParticipant[];
}>();

const manage = useManageStore();
const errorMessage = useApiErrorMessage();
const { t } = useI18n();

const action = computed(() => drawAction(props.event));
const blockers = computed(() =>
  props.event.status === 'open' ? drawBlockers(props.participants) : [],
);

const confirming = ref(false);
const running = ref(false);
const failure = ref<DrawFailure | null>(null);
const error = ref<string | null>(null);
const doneCount = ref<number | null>(null);

const reasonText = (reason: DrawBlocker | DrawFailure): string | null => {
  switch (reason.kind) {
    case 'tooFewParticipants':
      return t('manage.draw.reason.tooFewParticipants', {
        count: reason.count,
      });
    case 'notEveryoneInvited':
      return t('manage.draw.reason.notEveryoneInvited', {
        names: reason.names.join(', '),
      });
    case 'impossibleExclusions':
      return t('manage.draw.reason.impossibleExclusions');
    case 'redoTooLate':
      return t('manage.draw.reason.redoTooLate');
    default:
      return null;
  }
};

const run = async () => {
  running.value = true;
  failure.value = null;
  error.value = null;
  doneCount.value = null;
  try {
    const { participantCount } = await manage.runDraw();
    doneCount.value = participantCount;
    confirming.value = false;
  } catch (e) {
    const reason = drawFailure(e, manage.participants ?? props.participants);
    if (reason.kind === 'other') error.value = errorMessage(e);
    else failure.value = reason;
    confirming.value = false;
  } finally {
    running.value = false;
  }
};
</script>

<template>
  <section class="card" aria-labelledby="manage-draw-title">
    <h2 id="manage-draw-title" class="text-lg font-bold">
      {{ $t('manage.draw.title') }}
    </h2>
    <p class="mt-2 text-sm text-stone-600">{{ $t('manage.draw.lead') }}</p>

    <p v-if="event.drawnAt" class="mt-3 text-sm text-stone-700">
      {{ $t('manage.draw.drawnAt', { date: formatDrawnAt(event.drawnAt) }) }}
    </p>

    <div
      v-if="blockers.length > 0"
      class="alert-info mt-4"
      data-testid="draw-blockers"
    >
      <p class="font-semibold">{{ $t('manage.draw.blockedTitle') }}</p>
      <ul class="mt-1 list-disc space-y-1 pl-5">
        <li v-for="blocker in blockers" :key="blocker.kind">
          {{ reasonText(blocker) }}
        </li>
      </ul>
    </div>

    <template v-if="action">
      <p v-if="action === 'redo'" class="mt-3 text-sm text-stone-600">
        {{ $t('manage.draw.redoUntil') }}
      </p>

      <ConfirmPanel
        v-if="confirming"
        class="mt-4"
        :message="
          action === 'redo'
            ? $t('manage.draw.confirmRedo')
            : $t('manage.draw.confirmRun')
        "
        :confirm-label="
          action === 'redo'
            ? $t('manage.draw.confirmRedoYes')
            : $t('manage.draw.confirmRunYes')
        "
        :busy-label="$t('manage.draw.running')"
        :busy="running"
        confirm-testid="confirm-draw"
        @confirm="run"
        @cancel="confirming = false"
      />
      <button
        v-else
        type="button"
        :class="action === 'redo' ? 'btn-secondary' : 'btn-primary'"
        class="mt-4 w-full sm:w-auto"
        :disabled="blockers.length > 0"
        :data-testid="action === 'redo' ? 'redo-draw' : 'run-draw'"
        @click="confirming = true"
      >
        {{ action === 'redo' ? $t('manage.draw.redo') : $t('manage.draw.run') }}
      </button>
    </template>
    <p v-else class="mt-3 text-sm text-stone-600">
      {{ $t('manage.draw.redoClosed') }}
    </p>

    <p
      v-if="doneCount !== null"
      class="alert-info mt-3"
      role="status"
      data-testid="draw-done"
    >
      {{ $t('manage.draw.done', { count: doneCount }) }}
    </p>
    <p
      v-if="failure"
      class="alert-error mt-3"
      role="alert"
      data-testid="draw-failure"
    >
      {{ reasonText(failure) }}
    </p>
    <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
  </section>
</template>
