import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import {
  api,
  isApiError,
  type CreateWishlistInput,
  type MyClaim,
  type UpdateWishlistInput,
  type Wishlist,
  type WishlistItem,
} from '@/api';
import {
  groupWishlists,
  type WishlistGroups,
} from '@/wishlists/wishlistGroups';
import { useAuthStore } from './auth';
import { useEventsStore } from './events';

// Data loaded for one acting participant in one event.
interface Loaded<T> {
  // `<eventId>/<acting participant id>`.
  key: string;
  data: T;
}

// Wishlists and claims of the current event as the acting participant (the
// person or, as a caretaker, a managed participant) sees them. Data loaded
// for another event or profile is never shown; views reload when the acting
// profile changes.
export const useWishlistsStore = defineStore('wishlists', () => {
  const events = useEventsStore();

  const loadedWishlists = ref<Loaded<Wishlist[]> | null>(null);
  const loadedClaims = ref<Loaded<MyClaim[]> | null>(null);

  const currentKey = computed(() =>
    events.event && events.actingParticipant
      ? `${events.event.id}/${events.actingParticipant.id}`
      : null,
  );

  const context = () => {
    const key = currentKey.value;
    if (!events.event || !key) throw new Error('No event loaded');
    return { eventId: events.event.id, actingAs: events.actingAs, key };
  };

  // `GET /wishlists` for the current event and profile; null until loaded.
  const wishlists = computed(() =>
    loadedWishlists.value?.key === currentKey.value
      ? loadedWishlists.value.data
      : null,
  );
  // `GET /my-claims` for the current event and profile; null until loaded.
  const myClaims = computed(() =>
    loadedClaims.value?.key === currentKey.value
      ? loadedClaims.value.data
      : null,
  );

  const groups = computed<WishlistGroups | null>(() =>
    wishlists.value && events.actingParticipant
      ? groupWishlists(wishlists.value, events.actingParticipant.id)
      : null,
  );

  // The participants whose children the person counts as the parent of:
  // themselves and their managed participants. Claims on these children's
  // wishlists are hidden from them, whoever they act as.
  const familyParticipantIds = computed(
    () =>
      new Set(
        events.event
          ? [
              events.event.myParticipant.id,
              ...events.event.managedParticipants.map(({ id }) => id),
            ]
          : [],
      ),
  );

  const loadWishlists = async (): Promise<Wishlist[]> => {
    const { eventId, actingAs, key } = context();
    const data = await api.listWishlists(eventId, actingAs);
    // A response for a profile switched away from meanwhile is dropped.
    if (currentKey.value === key) loadedWishlists.value = { key, data };
    return data;
  };

  const loadMyClaims = async (): Promise<MyClaim[]> => {
    const { eventId, actingAs, key } = context();
    const data = await api.listMyClaims(eventId, actingAs);
    if (currentKey.value === key) loadedClaims.value = { key, data };
    return data;
  };

  // Applies a change to the loaded wishlists of `key`.
  const changeWishlists = (
    key: string,
    change: (list: Wishlist[]) => Wishlist[],
  ) => {
    if (loadedWishlists.value?.key !== key) return;
    loadedWishlists.value = {
      key,
      data: change(loadedWishlists.value.data),
    };
  };

  const changeItem = (
    key: string,
    itemId: string,
    change: (item: WishlistItem) => WishlistItem,
  ) =>
    changeWishlists(key, (list) =>
      list.map((wishlist) =>
        wishlist.items.some(({ id }) => id === itemId)
          ? {
              ...wishlist,
              items: wishlist.items.map((item) =>
                item.id === itemId ? change(item) : item,
              ),
            }
          : wishlist,
      ),
    );

  // Creates the acting participant's own wishlist or a child wishlist.
  const createWishlist = async (
    input: CreateWishlistInput,
  ): Promise<Wishlist> => {
    const { eventId, actingAs, key } = context();
    const created = await api.createWishlist(eventId, input, actingAs);
    changeWishlists(key, (list) =>
      created.childName === null ? [created, ...list] : [...list, created],
    );
    return created;
  };

  const updateWishlist = async (
    wishlistId: string,
    input: UpdateWishlistInput,
  ): Promise<Wishlist> => {
    const { eventId, actingAs, key } = context();
    const updated = await api.updateWishlist(
      eventId,
      wishlistId,
      input,
      actingAs,
    );
    changeWishlists(key, (list) =>
      list.map((wishlist) => (wishlist.id === updated.id ? updated : wishlist)),
    );
    return updated;
  };

  const deleteWishlist = async (wishlistId: string): Promise<void> => {
    const { eventId, actingAs, key } = context();
    await api.deleteWishlist(eventId, wishlistId, actingAs);
    changeWishlists(key, (list) =>
      list.filter((wishlist) => wishlist.id !== wishlistId),
    );
  };

  // Claims a child wishlist item for the acting participant. When someone
  // else was faster (`409`) the wishlists are reloaded to show who, and the
  // error is rethrown.
  const claim = async (itemId: string): Promise<MyClaim> => {
    const { eventId, actingAs, key } = context();
    const claimerName = events.actingParticipant?.displayName ?? '';
    try {
      const myClaim = await api.claimWishlistItem(eventId, itemId, actingAs);
      changeItem(key, itemId, (item) => ({
        ...item,
        claimedByMe: true,
        claimedBy: claimerName,
      }));
      if (loadedClaims.value?.key === key) {
        // The server's order (by wishlist and item) comes with the next load.
        loadedClaims.value = {
          key,
          data: [
            ...loadedClaims.value.data.filter(
              (entry) => entry.item.id !== itemId,
            ),
            myClaim,
          ],
        };
      }
      return myClaim;
    } catch (e) {
      if (isApiError(e) && e.kind === 'conflict') {
        await loadWishlists().catch(() => undefined);
      }
      throw e;
    }
  };

  // Releases the acting participant's claim on a child wishlist item.
  const releaseClaim = async (itemId: string): Promise<void> => {
    const { eventId, actingAs, key } = context();
    await api.releaseClaim(eventId, itemId, actingAs);
    changeItem(key, itemId, (item) => ({
      ...item,
      claimedByMe: false,
      claimedBy: null,
    }));
    if (loadedClaims.value?.key === key) {
      loadedClaims.value = {
        key,
        data: loadedClaims.value.data.filter(
          (entry) => entry.item.id !== itemId,
        ),
      };
    }
  };

  const clear = () => {
    loadedWishlists.value = null;
    loadedClaims.value = null;
  };

  // Another person may sign in on the same device.
  watch(
    () => useAuthStore().token,
    () => clear(),
  );

  return {
    wishlists,
    myClaims,
    groups,
    familyParticipantIds,
    loadWishlists,
    loadMyClaims,
    createWishlist,
    updateWishlist,
    deleteWishlist,
    claim,
    releaseClaim,
    clear,
  };
});
