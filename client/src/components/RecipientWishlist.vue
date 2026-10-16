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
      v-if="!wishlist || (wishlist.items.length === 0 && !wishlist.notes)"
      class="text-stone-600"
      data-testid="recipient-wishlist-empty"
    >
      {{ $t('assignment.wishlist.empty', { name: recipientName }) }}
    </p>
    <template v-else>
      <p
        v-if="wishlist.notes"
        class="rounded-xl bg-gold-300/25 px-4 py-3 break-words whitespace-pre-line text-stone-800 print:border print:border-stone-300 print:bg-transparent"
      >
        {{ wishlist.notes }}
      </p>
      <p
        v-if="wishlist.items.length === 0"
        class="mt-3 text-stone-600"
        data-testid="recipient-wishlist-empty"
      >
        {{ $t('assignment.wishlist.noItems') }}
      </p>
      <ol
        v-else
        class="mt-3 divide-y divide-stone-100 print:divide-stone-300"
        data-testid="recipient-wishlist"
      >
        <li
          v-for="(item, index) in wishlist.items"
          :key="item.id"
          class="flex gap-3 py-3 break-inside-avoid"
        >
          <span
            class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-pine-50 text-xs font-bold text-pine-700 print:border print:border-stone-400 print:bg-transparent"
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
              <p
                class="mt-1 hidden text-xs break-all text-stone-600 print:block"
              >
                {{ safeLink(item.url)!.href }}
              </p>
            </template>
          </div>
        </li>
      </ol>
    </template>
  </div>
</template>
