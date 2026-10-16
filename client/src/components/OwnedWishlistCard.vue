<script setup lang="ts">
import { ref } from 'vue';

import type { Wishlist } from '@/api';
import WishlistCard from './WishlistCard.vue';

// A wishlist as its owner sees it: read-only with "edit" and "delete" (after
// a confirmation) unless the event is finished.
defineProps<{
  wishlist: Wishlist;
  title: string;
  readOnly: boolean;
  // The question asked before deleting.
  deleteConfirmation: string;
  deleting: boolean;
  deleteError: string | null;
}>();

const emit = defineEmits<{ edit: []; delete: [] }>();

const confirmingDelete = ref(false);
</script>

<template>
  <WishlistCard :wishlist="wishlist" :title="title">
    <template v-if="!readOnly" #actions>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn-secondary min-h-9 px-3 py-1 text-sm"
          data-testid="wishlist-edit"
          @click="emit('edit')"
        >
          {{ $t('wishlists.edit') }}
        </button>
        <button
          type="button"
          class="btn-secondary min-h-9 px-3 py-1 text-sm"
          data-testid="wishlist-delete"
          @click="confirmingDelete = true"
        >
          {{ $t('wishlists.delete') }}
        </button>
      </div>
    </template>
    <div v-if="confirmingDelete" class="alert-error mt-4 space-y-3">
      <p>{{ deleteConfirmation }}</p>
      <div class="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          class="btn-primary"
          :disabled="deleting"
          data-testid="wishlist-delete-confirm"
          @click="emit('delete')"
        >
          {{
            deleting
              ? $t('wishlists.deleting')
              : $t('wishlists.confirmDeleteYes')
          }}
        </button>
        <button
          type="button"
          class="btn-secondary"
          :disabled="deleting"
          @click="confirmingDelete = false"
        >
          {{ $t('wishlists.cancel') }}
        </button>
      </div>
      <p v-if="deleteError" role="alert" class="font-semibold">
        {{ deleteError }}
      </p>
    </div>
  </WishlistCard>
</template>
