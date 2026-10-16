import type { MyClaim, Wishlist, WishlistItem } from '@/api';

export const isChildWishlist = (wishlist: Wishlist): boolean =>
  wishlist.childName !== null;

// The wishlists the server returns for the acting participant, by section:
// their own wishlist and their children's (`/wishlists`, editable) and the
// other parents' child wishlists (`/kids`). A recipient's wishlist (after
// the draw) belongs to neither and is left out.
export interface WishlistGroups {
  own: Wishlist | null;
  myChildren: Wishlist[];
  otherChildren: Wishlist[];
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
  otherChildren: wishlists.filter(
    (wishlist) =>
      isChildWishlist(wishlist) &&
      wishlist.participantId !== actingParticipantId,
  ),
});

// A child wishlist item's claim as the acting participant sees it. `hidden`:
// the person behind the request counts as the child's parent (the parent or
// their caretaker), so the server leaves claims out and they cannot claim.
export type ClaimState =
  | { kind: 'hidden' }
  | { kind: 'free' }
  | { kind: 'mine' }
  | { kind: 'taken'; by: string };

export const claimStateOf = (item: WishlistItem): ClaimState => {
  if (item.claimedBy === undefined && item.claimedByMe === undefined) {
    return { kind: 'hidden' };
  }
  if (item.claimedByMe) return { kind: 'mine' };
  if (item.claimedBy) return { kind: 'taken', by: item.claimedBy };
  return { kind: 'free' };
};

// Whether the person counts as the parent of the children on `wishlist`:
// it belongs to themselves or to someone they are the caretaker of. Claims
// there are hidden from them, whoever they act as.
export const isFamilyWishlist = (
  wishlist: Wishlist,
  familyParticipantIds: ReadonlySet<string>,
): boolean => familyParticipantIds.has(wishlist.participantId);

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
