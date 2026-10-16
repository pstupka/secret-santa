<script setup lang="ts">
// Inline confirmation of a destructive or far-reaching organizer action.
defineProps<{
  message: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  confirmTestid?: string;
}>();

defineEmits<{ confirm: []; cancel: [] }>();
</script>

<template>
  <div class="alert-error space-y-3" role="alertdialog" :aria-label="message">
    <p>{{ message }}</p>
    <div class="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        class="btn-primary"
        :disabled="busy"
        :data-testid="confirmTestid"
        @click="$emit('confirm')"
      >
        {{ busy ? busyLabel : confirmLabel }}
      </button>
      <button
        type="button"
        class="btn-secondary"
        :disabled="busy"
        @click="$emit('cancel')"
      >
        {{ $t('manage.cancel') }}
      </button>
    </div>
  </div>
</template>
