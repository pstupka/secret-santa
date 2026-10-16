<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { isApiError, type OrganizerParticipant } from '@/api';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { caretakerCandidates } from '@/manage/participants';
import { useManageStore } from '@/stores/manage';

// Adds a participant silently (no email is sent): one with an email, or a
// managed participant looked after by a caretaker.
const props = defineProps<{ participants: OrganizerParticipant[] }>();

const manage = useManageStore();
const errorMessage = useApiErrorMessage();
const { t } = useI18n();

const form = reactive({
  kind: 'email' as 'email' | 'managed',
  displayName: '',
  email: '',
  caretakerId: '',
});
const adding = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

const caretakers = computed(() => caretakerCandidates(props.participants));

const submit = async () => {
  adding.value = true;
  error.value = null;
  notice.value = null;
  const displayName = form.displayName.trim();
  try {
    if (form.kind === 'email') {
      await manage.addParticipant({ displayName, email: form.email.trim() });
      notice.value = t('manage.add.added', { name: displayName });
    } else {
      await manage.addParticipant({
        displayName,
        managedByParticipantId: form.caretakerId,
      });
      notice.value = t('manage.add.addedManaged', { name: displayName });
    }
    form.displayName = '';
    form.email = '';
  } catch (e) {
    if (isApiError(e) && e.kind === 'conflict') {
      error.value = t('manage.add.duplicate');
    } else if (
      isApiError(e) &&
      e.kind === 'validation' &&
      form.kind === 'managed'
    ) {
      error.value = t('manage.add.badCaretaker');
    } else {
      error.value = errorMessage(e);
    }
  } finally {
    adding.value = false;
  }
};
</script>

<template>
  <form
    class="space-y-4 rounded-xl bg-stone-50 p-4"
    data-testid="add-participant-form"
    @submit.prevent="submit"
  >
    <h3 class="text-base font-bold">{{ $t('manage.add.title') }}</h3>

    <fieldset>
      <legend class="sr-only">{{ $t('manage.add.kind') }}</legend>
      <div class="flex flex-col gap-2 sm:flex-row sm:gap-5">
        <label class="inline-flex min-h-9 items-center gap-2 text-sm">
          <input
            v-model="form.kind"
            type="radio"
            name="participant-kind"
            value="email"
            class="size-4 accent-pine-700"
          />
          {{ $t('manage.add.withEmail') }}
        </label>
        <label class="inline-flex min-h-9 items-center gap-2 text-sm">
          <input
            v-model="form.kind"
            type="radio"
            name="participant-kind"
            value="managed"
            class="size-4 accent-pine-700"
            data-testid="add-participant-managed"
          />
          {{ $t('manage.add.managed') }}
        </label>
      </div>
      <p v-if="form.kind === 'managed'" class="field-hint">
        {{ $t('manage.add.managedHint') }}
      </p>
    </fieldset>

    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <label for="add-display-name" class="field-label">
          {{ $t('manage.add.displayName') }}
        </label>
        <input
          id="add-display-name"
          v-model="form.displayName"
          type="text"
          required
          maxlength="100"
          class="field-input"
          :placeholder="$t('manage.add.displayNamePlaceholder')"
          data-testid="add-participant-name"
        />
      </div>

      <div v-if="form.kind === 'email'">
        <label for="add-email" class="field-label">
          {{ $t('manage.add.email') }}
        </label>
        <input
          id="add-email"
          v-model="form.email"
          type="email"
          required
          inputmode="email"
          autocomplete="off"
          class="field-input"
          data-testid="add-participant-email"
        />
      </div>

      <div v-else>
        <label for="add-caretaker" class="field-label">
          {{ $t('manage.add.caretaker') }}
        </label>
        <select
          id="add-caretaker"
          v-model="form.caretakerId"
          required
          class="field-input"
          data-testid="add-participant-caretaker"
        >
          <option value="" disabled>
            {{ $t('manage.add.chooseCaretaker') }}
          </option>
          <option
            v-for="caretaker in caretakers"
            :key="caretaker.id"
            :value="caretaker.id"
          >
            {{ caretaker.displayName }}
          </option>
        </select>
      </div>
    </div>

    <p v-if="error" class="alert-error" role="alert">{{ error }}</p>
    <p v-else-if="notice" class="alert-info" role="status">{{ notice }}</p>

    <button
      type="submit"
      class="btn-secondary w-full sm:w-auto"
      :disabled="adding"
      data-testid="add-participant-submit"
    >
      {{ adding ? $t('manage.add.adding') : $t('manage.add.submit') }}
    </button>
  </form>
</template>
