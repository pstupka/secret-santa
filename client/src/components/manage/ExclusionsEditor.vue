<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Exclusion, OrganizerParticipant } from '@/api';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { isExcluded, namedExclusions } from '@/manage/exclusions';
import { useManageStore } from '@/stores/manage';

// Pairs of participants who must not draw each other: pick two and add, or
// remove a pair. Built-in caretaker pairs are listed but cannot be removed.
const props = defineProps<{
  participants: OrganizerParticipant[];
  exclusions: Exclusion[];
  editable: boolean;
}>();

const manage = useManageStore();
const errorMessage = useApiErrorMessage();
const { t } = useI18n();

const pair = reactive({ first: '', second: '' });
const busy = ref(false);
const error = ref<string | null>(null);

const listed = computed(() =>
  namedExclusions(props.exclusions, props.participants),
);
const alreadyExcluded = computed(
  () =>
    pair.first !== '' &&
    pair.second !== '' &&
    isExcluded(props.exclusions, pair.first, pair.second),
);
const canAdd = computed(
  () =>
    pair.first !== '' &&
    pair.second !== '' &&
    pair.first !== pair.second &&
    !alreadyExcluded.value,
);

const run = async (action: () => Promise<unknown>) => {
  busy.value = true;
  error.value = null;
  try {
    await action();
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    return false;
  } finally {
    busy.value = false;
  }
};

const add = async () => {
  if (!canAdd.value) return;
  if (await run(() => manage.addExclusion(pair.first, pair.second))) {
    pair.first = '';
    pair.second = '';
  }
};

const remove = (exclusion: Exclusion) =>
  run(() => manage.removeExclusion(exclusion));

const removeLabel = (nameA: string, nameB: string) =>
  t('manage.exclusions.remove', { a: nameA, b: nameB });
</script>

<template>
  <section class="card" aria-labelledby="manage-exclusions-title">
    <h2 id="manage-exclusions-title" class="text-lg font-bold">
      {{ $t('manage.exclusions.title') }}
    </h2>
    <p class="mt-2 text-sm text-stone-600">
      {{ $t('manage.exclusions.lead') }}
    </p>

    <p v-if="listed.length === 0" class="mt-3 text-sm text-stone-500">
      {{ $t('manage.exclusions.empty') }}
    </p>
    <ul v-else class="mt-3 divide-y divide-stone-100" data-testid="exclusions">
      <li
        v-for="exclusion in listed"
        :key="exclusion.key"
        class="flex flex-wrap items-center justify-between gap-2 py-2.5"
        data-testid="exclusion-row"
      >
        <span class="text-stone-800">
          <span class="font-medium">{{ exclusion.nameA }}</span>
          <span class="mx-1.5 text-stone-400" aria-hidden="true">↔</span>
          <span class="font-medium">{{ exclusion.nameB }}</span>
          <span
            v-if="exclusion.builtIn"
            class="ml-2 rounded-full bg-gold-300/40 px-2 py-0.5 text-xs font-semibold text-pine-900"
            :title="$t('manage.exclusions.builtInHint')"
          >
            {{ $t('manage.exclusions.builtIn') }}
          </span>
        </span>
        <button
          v-if="editable && !exclusion.builtIn"
          type="button"
          class="min-h-9 rounded-xl px-3 py-1 text-sm font-semibold text-cranberry-700 hover:bg-cranberry-50 focus-visible:outline-2 focus-visible:outline-cranberry-600 disabled:opacity-60"
          :disabled="busy"
          :aria-label="removeLabel(exclusion.nameA, exclusion.nameB)"
          data-testid="remove-exclusion"
          @click="remove(exclusion)"
        >
          {{ $t('manage.participants.remove') }}
        </button>
      </li>
    </ul>

    <form
      v-if="editable && participants.length >= 2"
      class="mt-4 space-y-4 rounded-xl bg-stone-50 p-4"
      @submit.prevent="add"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="exclusion-first" class="field-label">
            {{ $t('manage.exclusions.first') }}
          </label>
          <select
            id="exclusion-first"
            v-model="pair.first"
            required
            class="field-input"
            data-testid="exclusion-first"
          >
            <option value="" disabled>
              {{ $t('manage.exclusions.choose') }}
            </option>
            <option
              v-for="participant in participants"
              :key="participant.id"
              :value="participant.id"
            >
              {{ participant.displayName }}
            </option>
          </select>
        </div>
        <div>
          <label for="exclusion-second" class="field-label">
            {{ $t('manage.exclusions.second') }}
          </label>
          <select
            id="exclusion-second"
            v-model="pair.second"
            required
            class="field-input"
            data-testid="exclusion-second"
          >
            <option value="" disabled>
              {{ $t('manage.exclusions.choose') }}
            </option>
            <option
              v-for="participant in participants"
              :key="participant.id"
              :value="participant.id"
              :disabled="participant.id === pair.first"
            >
              {{ participant.displayName }}
            </option>
          </select>
        </div>
      </div>
      <p v-if="alreadyExcluded" class="field-error" role="status">
        {{ $t('manage.exclusions.alreadyExcluded') }}
      </p>
      <button
        type="submit"
        class="btn-secondary w-full sm:w-auto"
        :disabled="busy || !canAdd"
        data-testid="add-exclusion"
      >
        {{
          busy ? $t('manage.exclusions.adding') : $t('manage.exclusions.submit')
        }}
      </button>
    </form>
    <p v-else-if="!editable" class="field-hint mt-4">
      {{ $t('manage.exclusions.locked') }}
    </p>

    <p v-if="error" class="alert-error mt-3" role="alert">{{ error }}</p>
  </section>
</template>
