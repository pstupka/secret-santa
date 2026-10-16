<script setup lang="ts">
import type { Wishlist, WishlistItem } from '@/api';
import WishlistItemList from './WishlistItemList.vue';

// A read-only wishlist: heading, the owner's notes and the gift ideas.
// Slots: `actions` (next to the heading, e.g. edit / delete), default
// (between the notes and the items, e.g. a notice) and `item` (per item, e.g.
// claim buttons).
defineProps<{
  wishlist: Wishlist;
  title: string;
  subtitle?: string;
}>();

defineSlots<{
  actions?: () => unknown;
  default?: () => unknown;
  item?: (props: { item: WishlistItem }) => unknown;
}>();
</script>

<template>
  <section class="card" data-testid="wishlist" :data-wishlist-id="wishlist.id">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-xl font-bold break-words">{{ title }}</h3>
        <p v-if="subtitle" class="mt-0.5 text-sm text-stone-500">
          {{ subtitle }}
        </p>
      </div>
      <slot name="actions" />
    </div>
    <div v-if="wishlist.notes" class="mt-3 rounded-xl bg-stone-50 px-4 py-3">
      <p class="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {{ $t('wishlist.notes') }}
      </p>
      <p class="mt-0.5 break-words whitespace-pre-line text-stone-700">
        {{ wishlist.notes }}
      </p>
    </div>
    <slot />
    <WishlistItemList :items="wishlist.items" class="mt-4">
      <template v-if="$slots.item" #item="{ item }">
        <slot name="item" :item="item" />
      </template>
    </WishlistItemList>
  </section>
</template>
