import { describe, expect, test } from 'vitest';

import type { MyClaim, Wishlist } from '@/api';
import {
  claimedCount,
  claimStateOf,
  groupClaims,
  groupWishlists,
  isFamilyWishlist,
} from './wishlistGroups';

const wishlist = (overrides: Partial<Wishlist>): Wishlist => ({
  id: 'w',
  participantId: 'ania',
  participantName: 'Ania',
  childName: null,
  notes: null,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  items: [],
  ...overrides,
});

const own = wishlist({ id: 'own' });
const stas = wishlist({ id: 'stas', childName: 'Staś' });
const zosia = wishlist({
  id: 'zosia',
  participantId: 'jan',
  participantName: 'Jan',
  childName: 'Zosia',
});
const recipient = wishlist({
  id: 'recipient',
  participantId: 'jan',
  participantName: 'Jan',
});

describe('wishlist groups', () => {
  test('splits own, my children and other children wishlists', () => {
    expect(groupWishlists([own, stas, zosia], 'ania')).toEqual({
      own,
      myChildren: [stas],
      otherChildren: [zosia],
    });
  });

  test('leaves out the recipient wishlist after the draw', () => {
    expect(groupWishlists([own, recipient, zosia], 'ania')).toEqual({
      own,
      myChildren: [],
      otherChildren: [zosia],
    });
  });

  test('without an own wishlist', () => {
    expect(groupWishlists([zosia], 'ania').own).toBeNull();
  });

  test('a caretaker acting as a managed participant sees their lists as own', () => {
    const babciaOwn = wishlist({ id: 'b', participantId: 'babcia' });

    const groups = groupWishlists([babciaOwn, stas, zosia], 'babcia');

    expect(groups.own).toBe(babciaOwn);
    expect(groups.otherChildren).toEqual([stas, zosia]);
  });

  test('family wishlists are those of oneself and of managed participants', () => {
    const family = new Set(['ania', 'babcia']);

    expect(isFamilyWishlist(stas, family)).toBe(true);
    expect(isFamilyWishlist(zosia, family)).toBe(false);
  });
});

describe('claim state', () => {
  const item = { id: 'i', title: 'Klocki', url: null, notes: null };

  test('hidden without claim info', () => {
    expect(claimStateOf(item)).toEqual({ kind: 'hidden' });
  });

  test('free, mine or taken', () => {
    expect(
      claimStateOf({ ...item, claimedByMe: false, claimedBy: null }),
    ).toEqual({ kind: 'free' });
    expect(
      claimStateOf({ ...item, claimedByMe: true, claimedBy: 'Ania' }),
    ).toEqual({ kind: 'mine' });
    expect(
      claimStateOf({ ...item, claimedByMe: false, claimedBy: 'Jan' }),
    ).toEqual({ kind: 'taken', by: 'Jan' });
  });

  test('counts claimed items', () => {
    const list = wishlist({
      childName: 'Zosia',
      items: [
        { ...item, id: 'a', claimedByMe: true, claimedBy: 'Ania' },
        { ...item, id: 'b', claimedByMe: false, claimedBy: 'Jan' },
        { ...item, id: 'c', claimedByMe: false, claimedBy: null },
      ],
    });

    expect(claimedCount(list)).toBe(2);
  });
});

describe('groupClaims', () => {
  const claim = (wishlistId: string, itemId: string): MyClaim => ({
    wishlistId,
    childName: wishlistId === 'zosia' ? 'Zosia' : 'Staś',
    parentName: 'Jan',
    claimedAt: '2026-10-16T10:00:00.000Z',
    item: { id: itemId, title: itemId, url: null, notes: null },
  });

  test('groups the shopping list by child wishlist in order', () => {
    const groups = groupClaims([
      claim('zosia', 'a'),
      claim('zosia', 'b'),
      claim('stas', 'c'),
    ]);

    expect(groups.map((group) => group.childName)).toEqual(['Zosia', 'Staś']);
    expect(groups[0]?.claims.map((c) => c.item.id)).toEqual(['a', 'b']);
  });
});
