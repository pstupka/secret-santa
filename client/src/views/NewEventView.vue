<script setup lang="ts">
import { computed, reactive, ref } from 'vue';

import { api, type Event } from '@/api';
import CheckInbox from '@/components/CheckInbox.vue';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import {
  BUDGET_CURRENCIES,
  browserTimezone,
  budgetToMinorUnits,
  emptyCreateEventForm,
  toCreateEventInput,
  todayIn,
} from '@/events/createEventForm';

const timezone = browserTimezone();
const minExchangeOn = todayIn(timezone);

const form = reactive(emptyCreateEventForm());
const submitting = ref(false);
const error = ref<string | null>(null);
const created = ref<{ event: Event; organizerEmail: string } | null>(null);
const errorMessage = useApiErrorMessage();

const budgetInvalid = computed(
  () => form.budget.trim() !== '' && budgetToMinorUnits(form.budget) === null,
);

const submit = async () => {
  if (budgetInvalid.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const input = toCreateEventInput(form, timezone);
    const event = await api.createEvent(input);
    created.value = { event, organizerEmail: input.organizerEmail };
    window.scrollTo({ top: 0 });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <CheckInbox
    v-if="created"
    :email="created.organizerEmail"
    :event-title="created.event.title"
  />

  <div v-else>
    <h1 class="text-3xl font-bold sm:text-4xl">{{ $t('newEvent.title') }}</h1>
    <p class="mt-2 text-stone-600">{{ $t('newEvent.lead') }}</p>

    <form class="mt-8 space-y-6" @submit.prevent="submit">
      <fieldset class="card space-y-5">
        <legend class="sr-only">{{ $t('newEvent.sections.event') }}</legend>
        <h2 class="text-lg font-bold" aria-hidden="true">
          {{ $t('newEvent.sections.event') }}
        </h2>

        <div>
          <label for="event-title" class="field-label">
            {{ $t('newEvent.fields.title') }}
          </label>
          <input
            id="event-title"
            v-model="form.title"
            type="text"
            required
            maxlength="200"
            class="field-input"
            :placeholder="$t('newEvent.fields.titlePlaceholder')"
          />
        </div>

        <div>
          <label for="event-exchange-on" class="field-label">
            {{ $t('newEvent.fields.exchangeOn') }}
          </label>
          <input
            id="event-exchange-on"
            v-model="form.exchangeOn"
            type="date"
            required
            :min="minExchangeOn"
            class="field-input"
            aria-describedby="event-timezone"
          />
          <p id="event-timezone" class="field-hint">
            {{ $t('newEvent.timezone', { timezone }) }}
          </p>
        </div>

        <div class="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <label for="event-budget" class="field-label">
              {{ $t('newEvent.fields.budget') }}
              <span class="font-normal text-stone-500">
                ({{ $t('common.optional') }})
              </span>
            </label>
            <input
              id="event-budget"
              v-model="form.budget"
              type="text"
              inputmode="decimal"
              class="field-input"
              :placeholder="$t('newEvent.fields.budgetPlaceholder')"
              :aria-invalid="budgetInvalid"
              :aria-describedby="
                budgetInvalid ? 'event-budget-error' : undefined
              "
            />
          </div>
          <div>
            <label for="event-budget-currency" class="field-label">
              {{ $t('newEvent.fields.budgetCurrency') }}
            </label>
            <select
              id="event-budget-currency"
              v-model="form.budgetCurrency"
              class="field-input"
            >
              <option
                v-for="currency in BUDGET_CURRENCIES"
                :key="currency"
                :value="currency"
              >
                {{ currency }}
              </option>
            </select>
          </div>
          <p
            v-if="budgetInvalid"
            id="event-budget-error"
            class="field-error col-span-2 -mt-1"
          >
            {{ $t('newEvent.fields.budgetInvalid') }}
          </p>
        </div>
      </fieldset>

      <fieldset class="card space-y-5">
        <legend class="sr-only">{{ $t('newEvent.sections.organizer') }}</legend>
        <h2 class="text-lg font-bold" aria-hidden="true">
          {{ $t('newEvent.sections.organizer') }}
        </h2>

        <div>
          <label for="organizer-name" class="field-label">
            {{ $t('newEvent.fields.organizerName') }}
          </label>
          <input
            id="organizer-name"
            v-model="form.organizerName"
            type="text"
            required
            maxlength="100"
            autocomplete="given-name"
            class="field-input"
            :placeholder="$t('newEvent.fields.organizerNamePlaceholder')"
          />
        </div>

        <div>
          <label for="organizer-email" class="field-label">
            {{ $t('newEvent.fields.organizerEmail') }}
          </label>
          <input
            id="organizer-email"
            v-model="form.organizerEmail"
            type="email"
            required
            autocomplete="email"
            inputmode="email"
            class="field-input"
            aria-describedby="organizer-email-hint"
          />
          <p id="organizer-email-hint" class="field-hint">
            {{ $t('newEvent.fields.organizerEmailHint') }}
          </p>
        </div>

        <p class="alert-info">{{ $t('newEvent.organizerTakesPart') }}</p>
      </fieldset>

      <fieldset class="card space-y-5">
        <legend class="sr-only">{{ $t('newEvent.sections.details') }}</legend>
        <h2 class="text-lg font-bold" aria-hidden="true">
          {{ $t('newEvent.sections.details') }}
        </h2>

        <div>
          <label for="event-description" class="field-label">
            {{ $t('newEvent.fields.description') }}
            <span class="font-normal text-stone-500">
              ({{ $t('common.optional') }})
            </span>
          </label>
          <textarea
            id="event-description"
            v-model="form.description"
            rows="3"
            maxlength="5000"
            class="field-input"
            :placeholder="$t('newEvent.fields.descriptionPlaceholder')"
          />
        </div>

        <div>
          <label for="event-rules" class="field-label">
            {{ $t('newEvent.fields.rules') }}
            <span class="font-normal text-stone-500">
              ({{ $t('common.optional') }})
            </span>
          </label>
          <textarea
            id="event-rules"
            v-model="form.rules"
            rows="3"
            maxlength="5000"
            class="field-input"
            :placeholder="$t('newEvent.fields.rulesPlaceholder')"
          />
        </div>
      </fieldset>

      <p v-if="error" class="alert-error" role="alert">{{ error }}</p>

      <button
        type="submit"
        class="btn-primary w-full sm:w-auto"
        :disabled="submitting"
      >
        {{ submitting ? $t('newEvent.creating') : $t('newEvent.submit') }}
      </button>
    </form>
  </div>
</template>
