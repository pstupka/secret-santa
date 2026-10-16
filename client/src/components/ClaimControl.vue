<script setup lang="ts">
import { computed } from 'vue';

import type { WishlistItem } from '@/api';
import { claimStateOf } from '@/wishlists/wishlistGroups';

// A child wishlist item's claim: "I'll buy this", who claimed it, or one's
// own claim with a button to release it. Nothing when claims are hidden
// (the child's parent).
const props = defineProps<{
  item: WishlistItem;
  // How one's own claim is labelled, e.g. "Kupujesz Ty".
  mineLabel: string;
  readOnly: boolean;
  pending: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ claim: []; release: [] }>();

const state = computed(() => claimStateOf(props.item));
</script>

<template>
  <div
    v-if="state.kind !== 'hidden'"
    class="flex shrink-0 flex-col items-start gap-1.5 sm:items-end"
    data-testid="claim"
    :data-claim-state="state.kind"
  >
    <template v-if="state.kind === 'mine'">
      <span
        class="inline-flex items-center gap-1 rounded-full bg-pine-50 px-2.5 py-0.5 text-xs font-semibold text-pine-700"
      >
        <span aria-hidden="true">✓</span> {{ mineLabel }}
      </span>
      <button
        v-if="!readOnly"
        type="button"
        class="btn-secondary min-h-9 px-3 py-1 text-sm"
        :disabled="pending"
        data-testid="claim-release"
        @click="emit('release')"
      >
        {{ pending ? $t('kids.saving') : $t('kids.release') }}
      </button>
    </template>
    <span
      v-else-if="state.kind === 'taken'"
      class="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold text-stone-600"
    >
      {{ $t('kids.taken', { name: state.by }) }}
    </span>
    <button
      v-else-if="!readOnly"
      type="button"
      class="btn-primary min-h-9 px-3 py-1 text-sm"
      :disabled="pending"
      data-testid="claim-item"
      @click="emit('claim')"
    >
      {{ pending ? $t('kids.saving') : $t('kids.claim') }}
    </button>
    <p
      v-if="error"
      class="text-sm font-medium text-cranberry-600 sm:max-w-56 sm:text-right"
      role="alert"
    >
      {{ error }}
    </p>
  </div>
</template>
