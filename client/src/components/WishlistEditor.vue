<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Wishlist } from '@/api';
import {
  emptyItemDraft,
  emptyWishlistDraft,
  hasDraftErrors,
  MAX_CHILD_NAME_LENGTH,
  MAX_ITEM_NOTES_LENGTH,
  MAX_ITEM_TITLE_LENGTH,
  MAX_ITEM_URL_LENGTH,
  MAX_ITEMS_PER_WISHLIST,
  MAX_WISHLIST_NOTES_LENGTH,
  moveItem,
  validateWishlistDraft,
  wishlistDraftOf,
  type ItemDraftError,
  type WishlistDraft,
  type WishlistDraftErrors,
} from '@/wishlists/wishlistDraft';

// Form for a new or an existing wishlist: the child's name (child wishlists
// only), notes and the gift ideas, which can be added, removed and
// reordered. Emits `submit` with a valid draft; the parent saves it and
// passes `saving` / `error` back.
const props = defineProps<{
  // The wishlist being edited; absent for a new one.
  wishlist?: Wishlist;
  isChild: boolean;
  saving?: boolean;
  error?: string | null;
}>();

const emit = defineEmits<{
  submit: [draft: WishlistDraft];
  cancel: [];
}>();

const { t } = useI18n();

const draft = ref<WishlistDraft>(
  props.wishlist ? wishlistDraftOf(props.wishlist) : emptyWishlistDraft(),
);
// Shown after the first submit attempt, then kept up to date.
const submitted = ref(false);
const errors = computed<WishlistDraftErrors>(() =>
  submitted.value
    ? validateWishlistDraft(draft.value, { isChild: props.isChild })
    : { items: {} },
);

const formId = `wishlist-editor-${Math.random().toString(36).slice(2, 8)}`;
const fieldId = (key: string, field: string) => `${formId}-${key}-${field}`;

const heading = computed(() => {
  if (props.wishlist) return t('wishlistEditor.edit');
  return props.isChild
    ? t('wishlistEditor.newChild')
    : t('wishlistEditor.newOwn');
});

const itemErrors = (key: string): ItemDraftError[] =>
  errors.value.items[key] ?? [];

const addItem = async () => {
  const item = emptyItemDraft();
  draft.value.items.push(item);
  await nextTick();
  document.getElementById(fieldId(item.key, 'title'))?.focus();
};

const removeItem = (index: number) => {
  draft.value.items.splice(index, 1);
};

const move = (index: number, offset: number) => {
  draft.value.items = moveItem(draft.value.items, index, offset);
};

const submit = () => {
  submitted.value = true;
  if (hasDraftErrors(errors.value)) return;
  emit('submit', draft.value);
};
</script>

<template>
  <form
    class="card space-y-5 border-pine-600/30"
    novalidate
    data-testid="wishlist-editor"
    @submit.prevent="submit"
  >
    <h3 class="text-xl font-bold">{{ heading }}</h3>

    <div v-if="isChild">
      <label :for="fieldId('wishlist', 'child')" class="field-label">
        {{ $t('wishlistEditor.childName') }}
      </label>
      <input
        :id="fieldId('wishlist', 'child')"
        v-model="draft.childName"
        type="text"
        class="field-input"
        autocomplete="off"
        :maxlength="MAX_CHILD_NAME_LENGTH"
        :placeholder="$t('wishlistEditor.childNamePlaceholder')"
        :aria-invalid="errors.childName ? 'true' : undefined"
        :aria-describedby="
          errors.childName ? fieldId('wishlist', 'child-error') : undefined
        "
        required
      />
      <p
        v-if="errors.childName"
        :id="fieldId('wishlist', 'child-error')"
        class="field-error"
      >
        {{ $t('wishlistEditor.errors.childNameRequired') }}
      </p>
    </div>

    <div>
      <label :for="fieldId('wishlist', 'notes')" class="field-label">
        {{ $t('wishlistEditor.notes') }}
        <span class="font-normal text-stone-500">
          ({{ $t('common.optional') }})
        </span>
      </label>
      <textarea
        :id="fieldId('wishlist', 'notes')"
        v-model="draft.notes"
        rows="2"
        class="field-input"
        :maxlength="MAX_WISHLIST_NOTES_LENGTH"
        :placeholder="$t('wishlistEditor.notesPlaceholder')"
      />
    </div>

    <fieldset>
      <legend class="field-label">{{ $t('wishlistEditor.items') }}</legend>
      <p class="field-hint mt-0! mb-3">{{ $t('wishlistEditor.itemsHint') }}</p>
      <p v-if="draft.items.length === 0" class="mb-3 text-stone-500">
        {{ $t('wishlistEditor.noItems') }}
      </p>
      <ol class="space-y-3">
        <li
          v-for="(item, index) in draft.items"
          :key="item.key"
          class="rounded-xl border border-stone-200 bg-stone-50/60 p-3 sm:p-4"
          data-testid="wishlist-editor-item"
        >
          <div class="mb-2 flex items-center justify-between gap-2">
            <span class="text-sm font-semibold text-stone-600">
              {{ $t('wishlistEditor.item', { number: index + 1 }) }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="icon-btn"
                :disabled="index === 0"
                :aria-label="$t('wishlistEditor.moveUp', { number: index + 1 })"
                :title="$t('wishlistEditor.moveUp', { number: index + 1 })"
                @click="move(index, -1)"
              >
                <span aria-hidden="true">↑</span>
              </button>
              <button
                type="button"
                class="icon-btn"
                :disabled="index === draft.items.length - 1"
                :aria-label="
                  $t('wishlistEditor.moveDown', { number: index + 1 })
                "
                :title="$t('wishlistEditor.moveDown', { number: index + 1 })"
                @click="move(index, 1)"
              >
                <span aria-hidden="true">↓</span>
              </button>
              <button
                type="button"
                class="icon-btn text-cranberry-600 hover:bg-cranberry-50"
                :aria-label="
                  $t('wishlistEditor.removeItem', { number: index + 1 })
                "
                :title="$t('wishlistEditor.removeItem', { number: index + 1 })"
                @click="removeItem(index)"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label :for="fieldId(item.key, 'title')" class="field-label">
                {{ $t('wishlistEditor.itemTitle') }}
              </label>
              <input
                :id="fieldId(item.key, 'title')"
                v-model="item.title"
                type="text"
                class="field-input"
                autocomplete="off"
                :maxlength="MAX_ITEM_TITLE_LENGTH"
                :placeholder="$t('wishlistEditor.itemTitlePlaceholder')"
                :aria-invalid="
                  itemErrors(item.key).includes('titleRequired')
                    ? 'true'
                    : undefined
                "
              />
              <p
                v-if="itemErrors(item.key).includes('titleRequired')"
                class="field-error"
              >
                {{ $t('wishlistEditor.errors.titleRequired') }}
              </p>
            </div>
            <div>
              <label :for="fieldId(item.key, 'url')" class="field-label">
                {{ $t('wishlistEditor.itemUrl') }}
                <span class="font-normal text-stone-500">
                  ({{ $t('common.optional') }})
                </span>
              </label>
              <input
                :id="fieldId(item.key, 'url')"
                v-model="item.url"
                type="url"
                inputmode="url"
                class="field-input"
                autocomplete="off"
                :maxlength="MAX_ITEM_URL_LENGTH"
                :placeholder="$t('wishlistEditor.itemUrlPlaceholder')"
                :aria-invalid="
                  itemErrors(item.key).includes('urlInvalid')
                    ? 'true'
                    : undefined
                "
              />
              <p
                v-if="itemErrors(item.key).includes('urlInvalid')"
                class="field-error"
              >
                {{ $t('wishlistEditor.errors.urlInvalid') }}
              </p>
            </div>
            <div>
              <label :for="fieldId(item.key, 'notes')" class="field-label">
                {{ $t('wishlistEditor.itemNotes') }}
                <span class="font-normal text-stone-500">
                  ({{ $t('common.optional') }})
                </span>
              </label>
              <input
                :id="fieldId(item.key, 'notes')"
                v-model="item.notes"
                type="text"
                class="field-input"
                autocomplete="off"
                :maxlength="MAX_ITEM_NOTES_LENGTH"
                :placeholder="$t('wishlistEditor.itemNotesPlaceholder')"
              />
            </div>
          </div>
        </li>
      </ol>
      <button
        v-if="draft.items.length < MAX_ITEMS_PER_WISHLIST"
        type="button"
        class="btn-secondary mt-3 w-full sm:w-auto"
        @click="addItem"
      >
        <span aria-hidden="true">+</span> {{ $t('wishlistEditor.addItem') }}
      </button>
      <p v-if="errors.tooManyItems" class="field-error">
        {{
          $t('wishlistEditor.errors.tooManyItems', {
            max: MAX_ITEMS_PER_WISHLIST,
          })
        }}
      </p>
    </fieldset>

    <p
      v-if="submitted && hasDraftErrors(errors)"
      class="alert-error"
      role="alert"
    >
      {{ $t('wishlistEditor.errors.fix') }}
    </p>
    <p v-else-if="error" class="alert-error" role="alert">{{ error }}</p>

    <div class="flex flex-col gap-2 sm:flex-row">
      <button
        type="submit"
        class="btn-primary"
        :disabled="saving"
        data-testid="wishlist-save"
      >
        {{ saving ? $t('wishlistEditor.saving') : $t('wishlistEditor.save') }}
      </button>
      <button
        type="button"
        class="btn-secondary"
        :disabled="saving"
        @click="emit('cancel')"
      >
        {{ $t('wishlistEditor.cancel') }}
      </button>
    </div>
  </form>
</template>
