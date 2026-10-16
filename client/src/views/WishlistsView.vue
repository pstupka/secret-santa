<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { Wishlist } from '@/api';
import OwnedWishlistCard from '@/components/OwnedWishlistCard.vue';
import WishlistEditor from '@/components/WishlistEditor.vue';
import { useActingProfileLoad } from '@/composables/useActingProfileLoad';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useEventsStore } from '@/stores/events';
import { useWishlistsStore } from '@/stores/wishlists';
import {
  createWishlistInput,
  MAX_CHILD_WISHLISTS,
  updateWishlistInput,
  type WishlistDraft,
} from '@/wishlists/wishlistDraft';

// `/events/:eventId/wishlists`: the acting participant's own wishlist and
// their children's wishlists — create, edit, reorder items, delete. Read-only
// once the event is finished.
const events = useEventsStore();
const store = useWishlistsStore();
const { t } = useI18n();
const errorMessage = useApiErrorMessage();

const { error, reload } = useActingProfileLoad(store.loadWishlists);

const acting = computed(() => events.actingParticipant);
const groups = computed(() => store.groups);
const readOnly = computed(() => events.event?.status === 'finished');

const ownTitle = computed(() =>
  acting.value?.isSelf
    ? t('wishlists.own.title')
    : t('wishlists.own.managedTitle', { name: acting.value?.displayName }),
);

// The wishlist being edited (its id), or a new own / child wishlist.
type Editing = { wishlistId: string } | { newWishlist: 'own' | 'child' };
const editing = ref<Editing | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);
const deletingId = ref<string | null>(null);
const deleteError = ref<{ wishlistId: string; message: string } | null>(null);

const resetUi = () => {
  editing.value = null;
  saveError.value = null;
  deleteError.value = null;
};
// Another profile starts without a half-edited wishlist.
watch(() => [events.event?.id, acting.value?.id], resetUi);

const startEditing = (next: Editing) => {
  resetUi();
  editing.value = next;
};

const isEditing = (wishlist: Wishlist) =>
  editing.value !== null &&
  'wishlistId' in editing.value &&
  editing.value.wishlistId === wishlist.id;
const isAdding = (kind: 'own' | 'child') =>
  editing.value !== null &&
  'newWishlist' in editing.value &&
  editing.value.newWishlist === kind;

const save = async (draft: WishlistDraft, wishlist?: Wishlist) => {
  saving.value = true;
  saveError.value = null;
  try {
    if (wishlist) {
      const isChild = wishlist.childName !== null;
      await store.updateWishlist(
        wishlist.id,
        updateWishlistInput(draft, { isChild }),
      );
    } else {
      const isChild = isAdding('child');
      await store.createWishlist(createWishlistInput(draft, { isChild }));
    }
    resetUi();
  } catch (e) {
    saveError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
};

const remove = async (wishlist: Wishlist) => {
  deletingId.value = wishlist.id;
  deleteError.value = null;
  try {
    await store.deleteWishlist(wishlist.id);
    if (isEditing(wishlist)) resetUi();
  } catch (e) {
    deleteError.value = { wishlistId: wishlist.id, message: errorMessage(e) };
  } finally {
    deletingId.value = null;
  }
};
const deleteErrorOf = (wishlist: Wishlist) =>
  deleteError.value?.wishlistId === wishlist.id
    ? deleteError.value.message
    : null;

const canAddChild = computed(
  () => (groups.value?.myChildren.length ?? 0) < MAX_CHILD_WISHLISTS,
);
</script>

<template>
  <div v-if="acting" class="space-y-10">
    <div v-if="error" class="alert-error" role="alert">
      <p>{{ error }}</p>
      <button
        type="button"
        class="mt-2 font-semibold underline underline-offset-2"
        @click="reload"
      >
        {{ $t('common.tryAgain') }}
      </button>
    </div>

    <p v-else-if="!groups" class="text-stone-600" role="status">
      {{ $t('wishlists.loading') }}
    </p>

    <template v-else>
      <p v-if="readOnly" class="alert-info" role="status">
        {{ $t('wishlists.finished') }}
      </p>

      <section aria-labelledby="own-wishlist-title" class="space-y-4">
        <div>
          <h2 id="own-wishlist-title" class="text-2xl font-bold">
            {{ ownTitle }}
          </h2>
          <p class="mt-1 text-sm text-stone-600">
            {{
              acting.isSelf
                ? $t('wishlists.own.visibility')
                : $t('wishlists.own.managedVisibility', {
                    name: acting.displayName,
                  })
            }}
          </p>
        </div>

        <template v-if="groups.own">
          <WishlistEditor
            v-if="isEditing(groups.own)"
            :wishlist="groups.own"
            :is-child="false"
            :saving="saving"
            :error="saveError"
            @submit="save($event, groups.own)"
            @cancel="resetUi"
          />
          <OwnedWishlistCard
            v-else
            :key="groups.own.id"
            :wishlist="groups.own"
            :title="ownTitle"
            :read-only="readOnly"
            :delete-confirmation="$t('wishlists.confirmDelete')"
            :deleting="deletingId === groups.own.id"
            :delete-error="deleteErrorOf(groups.own)"
            @edit="startEditing({ wishlistId: groups.own.id })"
            @delete="remove(groups.own)"
          />
        </template>

        <WishlistEditor
          v-else-if="isAdding('own')"
          :is-child="false"
          :saving="saving"
          :error="saveError"
          @submit="save($event)"
          @cancel="resetUi"
        />

        <div v-else class="card text-center">
          <p class="text-stone-700">
            {{
              acting.isSelf
                ? $t('wishlists.own.empty')
                : $t('wishlists.own.managedEmpty', {
                    name: acting.displayName,
                  })
            }}
          </p>
          <button
            v-if="!readOnly"
            type="button"
            class="btn-primary mt-4"
            data-testid="wishlist-create-own"
            @click="startEditing({ newWishlist: 'own' })"
          >
            {{ $t('wishlists.own.create') }}
          </button>
        </div>
      </section>

      <section aria-labelledby="child-wishlists-title" class="space-y-4">
        <div>
          <h2 id="child-wishlists-title" class="text-2xl font-bold">
            {{ $t('wishlists.children.title') }}
          </h2>
          <p class="mt-1 text-sm text-stone-600">
            {{ $t('wishlists.children.lead') }}
          </p>
        </div>

        <p
          v-if="groups.myChildren.length === 0 && !isAdding('child')"
          class="text-stone-500"
        >
          {{ $t('wishlists.children.empty') }}
        </p>

        <template v-for="child in groups.myChildren" :key="child.id">
          <WishlistEditor
            v-if="isEditing(child)"
            :wishlist="child"
            :is-child="true"
            :saving="saving"
            :error="saveError"
            @submit="save($event, child)"
            @cancel="resetUi"
          />
          <OwnedWishlistCard
            v-else
            :wishlist="child"
            :title="child.childName ?? ''"
            :read-only="readOnly"
            :delete-confirmation="
              $t('wishlists.confirmDeleteChild', { name: child.childName })
            "
            :deleting="deletingId === child.id"
            :delete-error="deleteErrorOf(child)"
            @edit="startEditing({ wishlistId: child.id })"
            @delete="remove(child)"
          />
        </template>

        <WishlistEditor
          v-if="isAdding('child')"
          :is-child="true"
          :saving="saving"
          :error="saveError"
          @submit="save($event)"
          @cancel="resetUi"
        />
        <template v-else-if="!readOnly">
          <button
            v-if="canAddChild"
            type="button"
            class="btn-secondary w-full sm:w-auto"
            data-testid="wishlist-create-child"
            @click="startEditing({ newWishlist: 'child' })"
          >
            <span aria-hidden="true">+</span>
            {{ $t('wishlists.children.add') }}
          </button>
          <p v-else class="field-hint">
            {{ $t('wishlists.children.limit', { max: MAX_CHILD_WISHLISTS }) }}
          </p>
        </template>
      </section>
    </template>
  </div>
</template>
