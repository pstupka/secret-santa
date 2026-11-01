<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { isApiError, type WishlistItem } from '@/api';
import ClaimControl from '@/components/ClaimControl.vue';
import WishlistCard from '@/components/WishlistCard.vue';
import { useActingProfileLoad } from '@/composables/useActingProfileLoad';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useEventsStore } from '@/stores/events';
import { useWishlistsStore } from '@/stores/wishlists';
import { claimedCount } from '@/wishlists/wishlistGroups';

// `/events/:eventId/kids`: every child wishlist of the event, the acting
// participant's own children included, with claim / release buttons and who
// claimed what.
const events = useEventsStore();
const store = useWishlistsStore();
const { t } = useI18n();
const errorMessage = useApiErrorMessage();

const { error, reload } = useActingProfileLoad(store.loadWishlists);

const acting = computed(() => events.actingParticipant);
const childWishlists = computed(() => store.groups?.allChildren ?? null);
const readOnly = computed(() => events.event?.status === 'finished');

const pendingItemId = ref<string | null>(null);
const claimError = ref<{ itemId: string; message: string } | null>(null);

watch(
  () => [events.event?.id, acting.value?.id],
  () => {
    claimError.value = null;
  },
);

const change = async (item: WishlistItem, action: 'claim' | 'release') => {
  pendingItemId.value = item.id;
  claimError.value = null;
  try {
    if (action === 'claim') await store.claim(item.id);
    else await store.releaseClaim(item.id);
  } catch (e) {
    claimError.value = {
      itemId: item.id,
      message:
        action === 'claim' && isApiError(e) && e.kind === 'conflict'
          ? t('kids.conflict')
          : errorMessage(e),
    };
  } finally {
    pendingItemId.value = null;
  }
};

const mineLabel = computed(() =>
  acting.value?.isSelf
    ? t('kids.mine')
    : t('kids.managedMine', { name: acting.value?.displayName }),
);
</script>

<template>
  <div v-if="acting" class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold">{{ $t('kids.title') }}</h2>
      <p class="mt-1 text-sm text-stone-600">{{ $t('kids.lead') }}</p>
    </div>

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

    <p v-else-if="!childWishlists" class="text-stone-600" role="status">
      {{ $t('wishlists.loading') }}
    </p>

    <template v-else>
      <p v-if="readOnly" class="alert-info" role="status">
        {{ $t('kids.finished') }}
      </p>

      <p v-if="childWishlists.length === 0" class="card text-stone-600">
        {{ $t('kids.empty') }}
      </p>

      <WishlistCard
        v-for="wishlist in childWishlists"
        :key="wishlist.id"
        :wishlist="wishlist"
        :title="wishlist.childName ?? ''"
        :subtitle="$t('wishlist.childOf', { name: wishlist.participantName })"
      >
        <template v-if="wishlist.items.length > 0" #actions>
          <span class="stamp border-stone-400 text-stone-700">
            {{
              $t('kids.claimedCount', {
                claimed: claimedCount(wishlist),
                total: wishlist.items.length,
              })
            }}
          </span>
        </template>

        <template #item="{ item }">
          <ClaimControl
            :item="item"
            :mine-label="mineLabel"
            :read-only="readOnly"
            :pending="pendingItemId === item.id"
            :error="claimError?.itemId === item.id ? claimError.message : null"
            @claim="change(item, 'claim')"
            @release="change(item, 'release')"
          />
        </template>
      </WishlistCard>
    </template>
  </div>
</template>
