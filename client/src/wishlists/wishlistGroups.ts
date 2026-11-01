import type { MyClaim, Wishlist, WishlistItem } from '@/api';

export const isChildWishlist = (wishlist: Wishlist): boolean =>
  wishlist.childName !== null;

// The wishlists the server returns for the acting participant, by section:
// their own wishlist and their children's (`/wishlists`, editable) and every
// child wishlist of the event, theirs included (`/kids`, with claims). A
// recipient's wishlist (after the draw) belongs to neither and is left out.
export interface WishlistGroups {
  own: Wishlist | null;
  myChildren: Wishlist[];
  allChildren: Wishlist[];
}

export const groupWishlists = (
  wishlists: Wishlist[],
  actingParticipantId: string,
): WishlistGroups => ({
  own:
    wishlists.find(
      (wishlist) =>
        !isChildWishlist(wishlist) &&
        wishlist.participantId === actingParticipantId,
    ) ?? null,
  myChildren: wishlists.filter(
    (wishlist) =>
      isChildWishlist(wishlist) &&
      wishlist.participantId === actingParticipantId,
  ),
  allChildren: wishlists.filter(isChildWishlist),
});

// A child wishlist item's claim as the acting participant sees it.
export type ClaimState =
  | { kind: 'free' }
  | { kind: 'mine' }
  | { kind: 'taken'; by: string };

export const claimStateOf = (item: WishlistItem): ClaimState => {
  if (item.claimedByMe) return { kind: 'mine' };
  if (item.claimedBy) return { kind: 'taken', by: item.claimedBy };
  return { kind: 'free' };
};

// How many of a child wishlist's items are claimed (by anyone).
export const claimedCount = (wishlist: Wishlist): number =>
  wishlist.items.filter((item) => {
    const state = claimStateOf(item);
    return state.kind === 'mine' || state.kind === 'taken';
  }).length;

// The shopping list by child wishlist, in the server's order.
export interface ClaimGroup {
  wishlistId: string;
  childName: string;
  parentName: string;
  claims: MyClaim[];
}

export const groupClaims = (claims: MyClaim[]): ClaimGroup[] => {
  const groups = new Map<string, ClaimGroup>();
  claims.forEach((claim) => {
    const group = groups.get(claim.wishlistId);
    if (group) {
      group.claims.push(claim);
    } else {
      groups.set(claim.wishlistId, {
        wishlistId: claim.wishlistId,
        childName: claim.childName,
        parentName: claim.parentName,
        claims: [claim],
      });
    }
  });
  return [...groups.values()];
};
