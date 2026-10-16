<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { isApiError, type Event } from '@/api';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import {
  BUDGET_CURRENCIES,
  budgetToMinorUnits,
  todayIn,
} from '@/events/createEventForm';
import {
  editEventFormFrom,
  timezoneOptions,
  toUpdateEventInput,
} from '@/manage/editEventForm';
import { useManageStore } from '@/stores/manage';

// Edits the event's details and exchange date (open or drawn events).
const props = defineProps<{ event: Event }>();

const manage = useManageStore();
const errorMessage = useApiErrorMessage();
const { t } = useI18n();

const form = reactive(editEventFormFrom(props.event));
const saving = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

// Another organizer tab or a reload may change the event underneath.
watch(
  () => props.event.updatedAt,
  () => Object.assign(form, editEventFormFrom(props.event)),
);

const readOnly = computed(() => props.event.status === 'finished');
const minExchangeOn = computed(() => todayIn(form.timezone));
const timezones = computed(() => timezoneOptions(props.event.timezone));
const budgetInvalid = computed(
  () => form.budget.trim() !== '' && budgetToMinorUnits(form.budget) === null,
);
const currencies = computed(() =>
  (BUDGET_CURRENCIES as readonly string[]).includes(form.budgetCurrency)
    ? BUDGET_CURRENCIES
    : [form.budgetCurrency, ...BUDGET_CURRENCIES],
);

const submit = async () => {
  if (budgetInvalid.value || readOnly.value) return;
  error.value = null;
  notice.value = null;
  const input = toUpdateEventInput(form, props.event);
  if (Object.keys(input).length === 0) {
    notice.value = t('manage.edit.noChanges');
    return;
  }
  saving.value = true;
  try {
    await manage.updateEvent(input);
    notice.value = t('manage.edit.saved');
  } catch (e) {
    error.value =
      isApiError(e) && e.kind === 'validation' && input.exchangeOn
        ? t('manage.edit.exchangeOnPast')
        : errorMessage(e);
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <section class="card" aria-labelledby="edit-event-title">
    <h2 id="edit-event-title" class="text-lg font-bold">
      {{ $t('manage.edit.title') }}
    </h2>

    <form class="mt-4 space-y-5" @submit.prevent="submit">
      <fieldset :disabled="readOnly || saving" class="space-y-5">
        <div>
          <label for="manage-title" class="field-label">
            {{ $t('newEvent.fields.title') }}
          </label>
          <input
            id="manage-title"
            v-model="form.title"
            type="text"
            required
            maxlength="200"
            class="field-input"
          />
        </div>

        <div class="grid gap-5 sm:grid-cols-2">
          <div>
            <label for="manage-exchange-on" class="field-label">
              {{ $t('newEvent.fields.exchangeOn') }}
            </label>
            <input
              id="manage-exchange-on"
              v-model="form.exchangeOn"
              type="date"
              required
              :min="minExchangeOn"
              class="field-input"
            />
          </div>
          <div>
            <label for="manage-timezone" class="field-label">
              {{ $t('manage.edit.timezone') }}
            </label>
            <select
              id="manage-timezone"
              v-model="form.timezone"
              class="field-input"
              aria-describedby="manage-timezone-hint"
            >
              <option v-for="zone in timezones" :key="zone" :value="zone">
                {{ zone }}
              </option>
            </select>
            <p id="manage-timezone-hint" class="field-hint">
              {{ $t('manage.edit.timezoneHint') }}
            </p>
          </div>
        </div>

        <div class="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label for="manage-budget" class="field-label">
              {{ $t('newEvent.fields.budget') }}
              <span class="font-normal text-stone-500">
                ({{ $t('common.optional') }})
              </span>
            </label>
            <input
              id="manage-budget"
              v-model="form.budget"
              type="text"
              inputmode="decimal"
              class="field-input"
              :placeholder="$t('newEvent.fields.budgetPlaceholder')"
              :aria-invalid="budgetInvalid"
              :aria-describedby="
                budgetInvalid ? 'manage-budget-error' : undefined
              "
            />
          </div>
          <div>
            <label for="manage-budget-currency" class="field-label">
              {{ $t('newEvent.fields.budgetCurrency') }}
            </label>
            <select
              id="manage-budget-currency"
              v-model="form.budgetCurrency"
              class="field-input"
            >
              <option
                v-for="currency in currencies"
                :key="currency"
                :value="currency"
              >
                {{ currency }}
              </option>
            </select>
          </div>
          <p
            v-if="budgetInvalid"
            id="manage-budget-error"
            class="field-error col-span-2 -mt-1"
          >
            {{ $t('newEvent.fields.budgetInvalid') }}
          </p>
        </div>

        <div>
          <label for="manage-description" class="field-label">
            {{ $t('newEvent.fields.description') }}
            <span class="font-normal text-stone-500">
              ({{ $t('common.optional') }})
            </span>
          </label>
          <textarea
            id="manage-description"
            v-model="form.description"
            rows="3"
            maxlength="5000"
            class="field-input"
          />
        </div>

        <div>
          <label for="manage-rules" class="field-label">
            {{ $t('newEvent.fields.rules') }}
            <span class="font-normal text-stone-500">
              ({{ $t('common.optional') }})
            </span>
          </label>
          <textarea
            id="manage-rules"
            v-model="form.rules"
            rows="3"
            maxlength="5000"
            class="field-input"
          />
        </div>
      </fieldset>

      <p v-if="event.status === 'drawn'" class="field-hint">
        {{ $t('manage.edit.drawnNote') }}
      </p>
      <p v-if="error" class="alert-error" role="alert">
        {{ error }}
      </p>
      <p v-else-if="notice" class="alert-info" role="status">
        {{ notice }}
      </p>

      <button
        v-if="!readOnly"
        type="submit"
        class="btn-primary w-full sm:w-auto"
        :disabled="saving"
        data-testid="save-event"
      >
        {{ saving ? $t('manage.edit.saving') : $t('manage.edit.submit') }}
      </button>
    </form>
  </section>
</template>
