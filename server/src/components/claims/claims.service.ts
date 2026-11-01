import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import { Clock, nowUtc } from '@shared/clock';
import {
  toWishlistItemDto,
  WishlistItemDto,
} from '@components/wishlists/wishlists.service';

// An entry of a participant's "my claims" shopping list.
export interface MyClaimDto {
  wishlistId: string;
  childName: string;
  // The child's parent: the owner of the child wishlist.
  parentName: string;
  claimedAt: string;
  item: WishlistItemDto;
}

const selectClaims = (db: Db, claimerId: string) =>
  db
    .selectFrom('wishlist_items')
    .innerJoin('wishlists', 'wishlists.id', 'wishlist_items.wishlist_id')
    .innerJoin('participants', 'participants.id', 'wishlists.participant_id')
    .selectAll('wishlist_items')
    .select([
      'wishlists.child_name',
      'participants.display_name as parent_name',
    ])
    .where('wishlist_items.claimed_by_participant_id', '=', claimerId)
    .orderBy('wishlists.created_at')
    .orderBy('wishlists.id')
    .orderBy('wishlist_items.position');

type ClaimRow = Awaited<
  ReturnType<ReturnType<typeof selectClaims>['executeTakeFirstOrThrow']>
>;

const toMyClaimDto = (row: ClaimRow): MyClaimDto => ({
  wishlistId: row.wishlist_id,
  // Claims only exist on child wishlists, and a claim always has its time.
  childName: row.child_name ?? '',
  parentName: row.parent_name,
  claimedAt: row.claimed_at ?? '',
  item: toWishlistItemDto(row),
});

// The participant's claimed items, by child wishlist (oldest first) in the
// owner's item order.
export const listMyClaims = async (
  db: Db,
  claimerId: string,
): Promise<MyClaimDto[]> =>
  (await selectClaims(db, claimerId).execute()).map(toMyClaimDto);

// Checks that `itemId` is on a child wishlist of `eventId`. Unknown items
// and items of own wishlists are `404`. Anyone may claim, the child's parent
// included.
const checkClaimable = async (
  db: Db,
  eventId: string,
  itemId: string,
): Promise<void> => {
  const item = await db
    .selectFrom('wishlist_items')
    .innerJoin('wishlists', 'wishlists.id', 'wishlist_items.wishlist_id')
    .select('wishlist_items.id')
    .where('wishlist_items.id', '=', itemId)
    .where('wishlists.event_id', '=', eventId)
    .where('wishlists.child_name', 'is not', null)
    .executeTakeFirst();
  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Wishlist item not found');
  }
};

// The current claimer of `itemId` (null = unclaimed); `404` if the item was
// removed meanwhile.
const currentClaimerOf = async (
  db: Db,
  itemId: string,
): Promise<string | null> => {
  const item = await db
    .selectFrom('wishlist_items')
    .select('claimed_by_participant_id')
    .where('id', '=', itemId)
    .executeTakeFirst();
  if (!item) {
    throw new AppError(httpStatus.NOT_FOUND, 'Wishlist item not found');
  }
  return item.claimed_by_participant_id;
};

// Claims the item for `claimerId`; repeating one's own claim changes nothing.
// The update only takes an unclaimed item, so of two concurrent claims only
// one wins and the other gets `409`.
export const claimWishlistItem = async (
  db: Db,
  clock: Clock,
  claimerId: string,
  eventId: string,
  itemId: string,
): Promise<MyClaimDto> => {
  await checkClaimable(db, eventId, itemId);
  const { numUpdatedRows } = await db
    .updateTable('wishlist_items')
    .set({
      claimed_by_participant_id: claimerId,
      claimed_at: nowUtc(clock),
    })
    .where('id', '=', itemId)
    .where('claimed_by_participant_id', 'is', null)
    .executeTakeFirst();
  if (
    Number(numUpdatedRows) === 0 &&
    (await currentClaimerOf(db, itemId)) !== claimerId
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      'The item is already claimed by someone else',
    );
  }
  return toMyClaimDto(
    await selectClaims(db, claimerId)
      .where('wishlist_items.id', '=', itemId)
      .executeTakeFirstOrThrow(),
  );
};

// Releases `claimerId`'s claim on the item; an unclaimed item stays as is.
export const releaseClaim = async (
  db: Db,
  claimerId: string,
  eventId: string,
  itemId: string,
): Promise<void> => {
  await checkClaimable(db, eventId, itemId);
  const { numUpdatedRows } = await db
    .updateTable('wishlist_items')
    .set({ claimed_by_participant_id: null, claimed_at: null })
    .where('id', '=', itemId)
    .where('claimed_by_participant_id', '=', claimerId)
    .executeTakeFirst();
  if (
    Number(numUpdatedRows) === 0 &&
    (await currentClaimerOf(db, itemId)) !== null
  ) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the claimer can release this claim',
    );
  }
};
