import httpStatus from 'http-status';

import AppError from '@core/utils/appError';
import { Db } from '@db/database';
import { ParticipantRow, WishlistItemRow, WishlistRow } from '@db/schema';
import { Clock, nowUtc } from '@shared/clock';
import newId from '@shared/ids';

// Abuse guard: a participant has their own wishlist plus at most this many
// child wishlists.
export const MAX_CHILD_WISHLISTS_PER_PARTICIPANT = 10;

export interface WishlistItemDto {
  id: string;
  title: string;
  url: string | null;
  notes: string | null;
  // Claim info, only on child wishlists and never for the child's parent
  // (see `ClaimReader`): whether the reader holds the claim, and the
  // claimer's name (null = unclaimed).
  claimedByMe?: boolean;
  claimedBy?: string | null;
}

export interface WishlistDto {
  id: string;
  // The owner: the participant whose wishlist it is, or the parent of a child.
  participantId: string;
  participantName: string;
  // null = the participant's own wishlist; otherwise a child wishlist.
  childName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // In the owner's order.
  items: WishlistItemDto[];
}

export interface WishlistItemInput {
  title: string;
  url: string | null;
  notes: string | null;
}

export interface CreateWishlistInput {
  childName: string | null;
  notes: string | null;
  items: WishlistItemInput[];
}

export interface UpdateWishlistInput {
  childName?: string;
  notes?: string | null;
  // Replaces all items; an item with the `id` of an existing item keeps it.
  items?: (WishlistItemInput & { id?: string })[];
}

export const toWishlistItemDto = (item: WishlistItemRow): WishlistItemDto => ({
  id: item.id,
  title: item.title,
  url: item.url,
  notes: item.notes,
});

// Whoever reads claims on child wishlist items.
export interface ClaimReader {
  // The participant the request acts as; claims are made in their name.
  participantId: string;
  // The person behind the request and the managed participants they are the
  // caretaker of. They count as the parent of these participants' children:
  // claims on those child wishlists are hidden from them and they cannot
  // claim there, also when acting as someone else (X-Acting-As).
  actsForIds: string[];
}

// The claim reader for a request acting as `participant`, by `caretaker` when
// acting as a managed participant.
export const claimReaderOf = async (
  db: Db,
  participant: ParticipantRow,
  caretaker?: ParticipantRow,
): Promise<ClaimReader> => {
  const caller = caretaker ?? participant;
  const managed = await db
    .selectFrom('participants')
    .select('id')
    .where('managed_by_participant_id', '=', caller.id)
    .execute();
  return {
    participantId: participant.id,
    actsForIds: [caller.id, ...managed.map(({ id }) => id)],
  };
};

// Whether `reader` sees claims on the items of `wishlist`.
const showsClaims = (
  wishlist: Pick<WishlistRow, 'participant_id' | 'child_name'>,
  reader?: ClaimReader,
): reader is ClaimReader =>
  reader !== undefined &&
  wishlist.child_name !== null &&
  !reader.actsForIds.includes(wishlist.participant_id);

type WishlistWithOwner = WishlistRow & { participant_name: string };

const selectWishlistsWithOwner = (db: Db) =>
  db
    .selectFrom('wishlists')
    .innerJoin('participants', 'participants.id', 'wishlists.participant_id')
    .selectAll('wishlists')
    .select('participants.display_name as participant_name');

// Wishlists with their items, keeping the order of `wishlists`. Items carry
// claim info only for a `reader` who may see it.
const withItems = async (
  db: Db,
  wishlists: WishlistWithOwner[],
  reader?: ClaimReader,
): Promise<WishlistDto[]> => {
  if (wishlists.length === 0) return [];
  const items = await db
    .selectFrom('wishlist_items')
    .leftJoin(
      'participants as claimer',
      'claimer.id',
      'wishlist_items.claimed_by_participant_id',
    )
    .selectAll('wishlist_items')
    .select('claimer.display_name as claimer_name')
    .where(
      'wishlist_items.wishlist_id',
      'in',
      wishlists.map((wishlist) => wishlist.id),
    )
    .orderBy('wishlist_items.position')
    .execute();
  return wishlists.map((wishlist) => ({
    id: wishlist.id,
    participantId: wishlist.participant_id,
    participantName: wishlist.participant_name,
    childName: wishlist.child_name,
    notes: wishlist.notes,
    createdAt: wishlist.created_at,
    updatedAt: wishlist.updated_at,
    items: items
      .filter((item) => item.wishlist_id === wishlist.id)
      .map((item) =>
        showsClaims(wishlist, reader)
          ? {
              ...toWishlistItemDto(item),
              claimedByMe:
                item.claimed_by_participant_id === reader.participantId,
              claimedBy: item.claimer_name,
            }
          : toWishlistItemDto(item),
      ),
  }));
};

// The participant's own wishlist, if they have one. Before the draw only the
// owner (and their caretaker) may read it; the draw adds their Secret Santa.
export const findOwnWishlist = async (
  db: Db,
  participantId: string,
): Promise<WishlistDto | undefined> => {
  const wishlist = await selectWishlistsWithOwner(db)
    .where('wishlists.participant_id', '=', participantId)
    .where('wishlists.child_name', 'is', null)
    .executeTakeFirst();
  return wishlist && (await withItems(db, [wishlist]))[0];
};

// What `viewer` may read: their own wishlist first, then once drawn their
// recipient's own wishlist (the viewer is their Santa), then every child
// wishlist of the event, oldest first. Child wishlist items carry claim info
// unless the reader counts as the child's parent (see `ClaimReader`);
// `caretaker` is set when acting as a managed participant.
export const listVisibleWishlists = async (
  db: Db,
  viewer: ParticipantRow,
  caretaker?: ParticipantRow,
): Promise<WishlistDto[]> => {
  const recipientId = (
    await db
      .selectFrom('assignments')
      .select('receiver_id')
      .where('event_id', '=', viewer.event_id)
      .where('giver_id', '=', viewer.id)
      .executeTakeFirst()
  )?.receiver_id;
  const ownWishlistsOf = [viewer.id, ...(recipientId ? [recipientId] : [])];
  const wishlists = await selectWishlistsWithOwner(db)
    .where('wishlists.event_id', '=', viewer.event_id)
    .where((eb) =>
      eb.or([
        eb.and([
          eb('wishlists.participant_id', 'in', ownWishlistsOf),
          eb('wishlists.child_name', 'is', null),
        ]),
        eb('wishlists.child_name', 'is not', null),
      ]),
    )
    .orderBy('wishlists.created_at')
    .orderBy('wishlists.id')
    .execute();
  // Stable: the viewer's own wishlist, then the recipient's, then children
  // in creation order.
  const rank = (wishlist: WishlistWithOwner) => {
    if (wishlist.child_name !== null) return 2;
    return wishlist.participant_id === viewer.id ? 0 : 1;
  };
  wishlists.sort((a, b) => rank(a) - rank(b));
  return withItems(db, wishlists, await claimReaderOf(db, viewer, caretaker));
};

const insertItems = (
  db: Db,
  wishlistId: string,
  items: (WishlistItemInput & { position: number })[],
) =>
  items.length === 0
    ? Promise.resolve()
    : db
        .insertInto('wishlist_items')
        .values(
          items.map((item) => ({
            id: newId(),
            wishlist_id: wishlistId,
            position: item.position,
            title: item.title,
            url: item.url,
            notes: item.notes,
            claimed_by_participant_id: null,
            claimed_at: null,
          })),
        )
        .execute()
        .then(() => undefined);

const getWishlist = async (
  db: Db,
  wishlistId: string,
): Promise<WishlistDto> => {
  const wishlist = await selectWishlistsWithOwner(db)
    .where('wishlists.id', '=', wishlistId)
    .executeTakeFirstOrThrow();
  return (await withItems(db, [wishlist]))[0];
};

// Creates a wishlist owned by `owner`: their own (at most one) or a child's.
export const createWishlist = async (
  db: Db,
  clock: Clock,
  owner: ParticipantRow,
  input: CreateWishlistInput,
): Promise<WishlistDto> => {
  const id = await db.transaction().execute(async (trx) => {
    const existing = await trx
      .selectFrom('wishlists')
      .select(['child_name'])
      .where('participant_id', '=', owner.id)
      .execute();
    if (input.childName === null) {
      if (existing.some((wishlist) => wishlist.child_name === null)) {
        throw new AppError(
          httpStatus.CONFLICT,
          'The participant already has their own wishlist',
        );
      }
    } else if (
      existing.filter((wishlist) => wishlist.child_name !== null).length >=
      MAX_CHILD_WISHLISTS_PER_PARTICIPANT
    ) {
      throw new AppError(
        httpStatus.CONFLICT,
        `A participant can have at most ${MAX_CHILD_WISHLISTS_PER_PARTICIPANT} child wishlists`,
      );
    }

    const now = nowUtc(clock);
    const wishlistId = newId();
    await trx
      .insertInto('wishlists')
      .values({
        id: wishlistId,
        event_id: owner.event_id,
        participant_id: owner.id,
        child_name: input.childName,
        notes: input.notes,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await insertItems(
      trx,
      wishlistId,
      input.items.map((item, position) => ({ ...item, position })),
    );
    return wishlistId;
  });
  return getWishlist(db, id);
};

// The wishlist `wishlistId` of `owner`'s event, for a change by `owner`.
// Wishlists `owner` may not read (someone else's own wishlist, other
// events) are `404`; another participant's child wishlist is `403`.
const findOwnedWishlist = async (
  db: Db,
  owner: ParticipantRow,
  wishlistId: string,
): Promise<WishlistRow> => {
  const wishlist = await db
    .selectFrom('wishlists')
    .selectAll()
    .where('id', '=', wishlistId)
    .where('event_id', '=', owner.event_id)
    .executeTakeFirst();
  if (
    !wishlist ||
    (wishlist.participant_id !== owner.id && wishlist.child_name === null)
  ) {
    throw new AppError(httpStatus.NOT_FOUND, 'Wishlist not found');
  }
  if (wishlist.participant_id !== owner.id) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      'Only the owner can change this wishlist',
    );
  }
  return wishlist;
};

// Partial update by the owner. Given `items` replace the list in order:
// items passed with their `id` keep it (and any claim), the rest are new,
// and items left out are removed.
export const updateWishlist = async (
  db: Db,
  clock: Clock,
  owner: ParticipantRow,
  wishlistId: string,
  input: UpdateWishlistInput,
): Promise<WishlistDto> => {
  const wishlist = await findOwnedWishlist(db, owner, wishlistId);
  if (input.childName !== undefined && wishlist.child_name === null) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'An own wishlist cannot get a child name',
    );
  }

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('wishlists')
      .set({
        ...(input.childName !== undefined && { child_name: input.childName }),
        ...(input.notes !== undefined && { notes: input.notes || null }),
        updated_at: nowUtc(clock),
      })
      .where('id', '=', wishlist.id)
      .execute();

    if (input.items === undefined) return;
    const existingIds = new Set(
      (
        await trx
          .selectFrom('wishlist_items')
          .select('id')
          .where('wishlist_id', '=', wishlist.id)
          .execute()
      ).map((item) => item.id),
    );
    const items = input.items.map((item, position) => ({ ...item, position }));
    const unknown = items.find(
      (item) => item.id !== undefined && !existingIds.has(item.id),
    );
    if (unknown) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `Item ${unknown.id} is not on this wishlist`,
      );
    }

    const kept = items.flatMap((item) =>
      item.id === undefined ? [] : [{ ...item, id: item.id }],
    );
    const keptIds = kept.map((item) => item.id);
    let removal = trx
      .deleteFrom('wishlist_items')
      .where('wishlist_id', '=', wishlist.id);
    if (keptIds.length > 0) removal = removal.where('id', 'not in', keptIds);
    await removal.execute();

    // eslint-disable-next-line no-restricted-syntax
    for (const item of kept) {
      // eslint-disable-next-line no-await-in-loop
      await trx
        .updateTable('wishlist_items')
        .set({
          position: item.position,
          title: item.title,
          url: item.url,
          notes: item.notes,
        })
        .where('id', '=', item.id)
        .execute();
    }
    await insertItems(
      trx,
      wishlist.id,
      items.filter((item) => item.id === undefined),
    );
  });
  return getWishlist(db, wishlist.id);
};

// Deletes the owner's wishlist with its items (and their claims).
export const deleteWishlist = async (
  db: Db,
  owner: ParticipantRow,
  wishlistId: string,
): Promise<void> => {
  const wishlist = await findOwnedWishlist(db, owner, wishlistId);
  await db.deleteFrom('wishlists').where('id', '=', wishlist.id).execute();
};
