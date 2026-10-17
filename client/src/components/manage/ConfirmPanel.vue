<script setup lang="ts">
import { onMounted, ref } from 'vue';

// Inline confirmation of a far-reaching action. `destructive` (the default)
// is for deleting or removing; `commit` for a deliberate step forward such as
// running the draw, which must not look like a warning. Takes focus when it
// opens, and Escape cancels.
const props = withDefaults(
  defineProps<{
    message: string;
    confirmLabel: string;
    busyLabel: string;
    busy: boolean;
    confirmTestid?: string;
    tone?: 'destructive' | 'commit';
  }>(),
  { tone: 'destructive', confirmTestid: undefined },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const confirmButton = ref<HTMLButtonElement | null>(null);

onMounted(() => confirmButton.value?.focus());

const cancel = () => {
  if (!props.busy) emit('cancel');
};
</script>

<template>
  <div
    class="sheet-rule space-y-4 pt-4"
    :class="
      tone === 'commit' ? 'text-pine-900' : 'font-bold text-cranberry-700'
    "
    role="alertdialog"
    :aria-label="message"
    @keydown.esc.stop="cancel"
  >
    <p>{{ message }}</p>
    <div class="flex flex-col gap-2 sm:flex-row">
      <button
        ref="confirmButton"
        type="button"
        :class="
          tone === 'commit'
            ? 'btn bg-pine-700 text-white shadow-sm hover:bg-pine-900 focus-visible:outline-pine-700'
            : 'btn-primary'
        "
        :disabled="busy"
        :data-testid="confirmTestid"
        @click="emit('confirm')"
      >
        {{ busy ? busyLabel : confirmLabel }}
      </button>
      <button
        type="button"
        class="btn-secondary"
        :disabled="busy"
        @click="cancel"
      >
        {{ $t('manage.cancel') }}
      </button>
    </div>
  </div>
</template>
