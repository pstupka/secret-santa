<script setup lang="ts">
import type { Wishlist } from '@/api';
import { safeLink } from '@/assignment/myAssignment';

// Read-only view of the recipient's wishlist on the assignment page and its
// print view. On paper, links show their full address.
defineProps<{
  wishlist: Wishlist | null;
  recipientName: string;
}>();
</script>

<template>
  <div>
    <p
      v-if="!wishlist || wishlist.items.length === 0"
      class="text-stone-600"
      data-testid="recipient-wishlist-empty"
    >
      {{ $t('assignment.wishlist.empty', { name: recipientName }) }}
    </p>
    <ol
      v-else
      class="divide-y divide-dashed divide-kraft-400 print:divide-stone-300"
      data-testid="recipient-wishlist"
    >
      <li
        v-for="(item, index) in wishlist.items"
        :key="item.id"
        class="flex gap-3 py-3 break-inside-avoid"
      >
        <span
          class="w-6 shrink-0 pt-px text-right font-display font-bold text-cranberry-700 tabular-nums"
          aria-hidden="true"
        >
          {{ index + 1 }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold break-words text-stone-900">
            {{ item.title }}
          </p>
          <p
            v-if="item.notes"
            class="mt-0.5 text-sm break-words whitespace-pre-line text-stone-600"
          >
            {{ item.notes }}
          </p>
          <template v-if="safeLink(item.url)">
            <a
              :href="safeLink(item.url)!.href"
              target="_blank"
              rel="noopener noreferrer"
              class="mt-1 inline-flex items-center gap-1 text-sm font-semibold break-all text-pine-700 underline-offset-2 hover:underline print:hidden"
            >
              {{
                $t('assignment.wishlist.link', {
                  host: safeLink(item.url)!.hostname,
                })
              }}
              <span aria-hidden="true">↗</span>
            </a>
            <p class="mt-1 hidden text-xs break-all text-stone-600 print:block">
              {{ safeLink(item.url)!.href }}
            </p>
          </template>
        </div>
      </li>
    </ol>
  </div>
</template>
