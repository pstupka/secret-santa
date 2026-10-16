<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import WishlistItemList from '@/components/WishlistItemList.vue';
import { useActingProfileLoad } from '@/composables/useActingProfileLoad';
import { useApiErrorMessage } from '@/composables/useApiErrorMessage';
import { useEventsStore } from '@/stores/events';
import { useWishlistsStore } from '@/stores/wishlists';
import { groupClaims } from '@/wishlists/wishlistGroups';

// `/events/:eventId/claims`: the acting participant's claims as a shopping
// list, by child, with a button to release each claim.
const events = useEventsStore();
const store = useWishlistsStore();
const errorMessage = useApiErrorMessage();

const { error, reload } = useActingProfileLoad(store.loadMyClaims);

const acting = computed(() => events.actingParticipant);
const groups = computed(() =>
  store.myClaims ? groupClaims(store.myClaims) : null,
);
const readOnly = computed(() => events.event?.status === 'finished');

const pendingItemId = ref<string | null>(null);
const releaseError = ref<{ itemId: string; message: string } | null>(null);

watch(
  () => [events.event?.id, acting.value?.id],
  () => {
    releaseError.value = null;
  },
);

const release = async (itemId: string) => {
  pendingItemId.value = itemId;
  releaseError.value = null;
  try {
    await store.releaseClaim(itemId);
  } catch (e) {
    releaseError.value = { itemId, message: errorMessage(e) };
  } finally {
    pendingItemId.value = null;
  }
};
</script>

<template>
  <div v-if="acting && events.event" class="space-y-6">
    <div>
      <h2 class="text-2xl font-bold">{{ $t('claims.title') }}</h2>
      <p class="mt-1 text-sm text-stone-600">
        {{
          acting.isSelf
            ? $t('claims.lead')
            : $t('claims.managedLead', { name: acting.displayName })
        }}
      </p>
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

    <p v-else-if="!groups" class="text-stone-600" role="status">
      {{ $t('claims.loading') }}
    </p>

    <div v-else-if="groups.length === 0" class="card text-center">
      <p class="text-lg font-semibold text-pine-900">
        {{ $t('claims.empty') }}
      </p>
      <p class="mt-2 text-stone-600">{{ $t('claims.emptyLead') }}</p>
      <RouterLink
        :to="{ name: 'event-kids', params: { eventId: events.event.id } }"
        class="btn-primary mt-5"
      >
        {{ $t('claims.goToKids') }}
      </RouterLink>
    </div>

    <template v-else>
      <section
        v-for="group in groups"
        :key="group.wishlistId"
        class="card"
        data-testid="claim-group"
      >
        <h3 class="text-xl font-bold break-words">
          {{ $t('claims.forChild', { name: group.childName }) }}
        </h3>
        <p class="mt-0.5 text-sm text-stone-500">
          {{ $t('wishlist.childOf', { name: group.parentName }) }}
        </p>
        <WishlistItemList
          :items="group.claims.map(({ item }) => item)"
          class="mt-4"
        >
          <template v-if="!readOnly" #item="{ item }">
            <div
              class="flex shrink-0 flex-col items-start gap-1.5 sm:items-end"
            >
              <button
                type="button"
                class="btn-secondary min-h-9 px-3 py-1 text-sm"
                :disabled="pendingItemId === item.id"
                data-testid="claim-release"
                @click="release(item.id)"
              >
                {{
                  pendingItemId === item.id
                    ? $t('claims.saving')
                    : $t('claims.release')
                }}
              </button>
              <p
                v-if="releaseError?.itemId === item.id"
                class="text-sm font-medium text-cranberry-600 sm:text-right"
                role="alert"
              >
                {{ releaseError.message }}
              </p>
            </div>
          </template>
        </WishlistItemList>
      </section>
    </template>
  </div>
</template>
