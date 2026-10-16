<script setup lang="ts">
import type { WishlistItem } from '@/api';

// Read-only gift ideas of a wishlist in the owner's order. The `item` slot
// adds per-item content, e.g. claim buttons on a child wishlist.
defineProps<{ items: WishlistItem[] }>();

defineSlots<{
  item?: (props: { item: WishlistItem }) => unknown;
}>();

// "allegro.pl" for "https://allegro.pl/oferta/1": where the link leads.
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};
</script>

<template>
  <p v-if="items.length === 0" class="text-stone-500">
    {{ $t('wishlist.empty') }}
  </p>
  <ol v-else class="divide-y divide-stone-100">
    <li
      v-for="item in items"
      :key="item.id"
      class="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
      data-testid="wishlist-item"
    >
      <div class="min-w-0">
        <p class="font-semibold break-words text-stone-800">
          {{ item.title }}
        </p>
        <p
          v-if="item.notes"
          class="mt-0.5 text-sm break-words whitespace-pre-line text-stone-600"
        >
          {{ item.notes }}
        </p>
        <a
          v-if="item.url"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer nofollow"
          class="mt-1 inline-flex max-w-full items-center gap-1 text-sm font-semibold text-pine-700 underline-offset-2 hover:underline"
          :title="item.url"
        >
          <span class="truncate">{{ hostOf(item.url) }}</span>
          <span aria-hidden="true">↗</span>
          <span class="sr-only">({{ $t('wishlist.openLink') }})</span>
        </a>
      </div>
      <slot name="item" :item="item" />
    </li>
  </ol>
</template>
