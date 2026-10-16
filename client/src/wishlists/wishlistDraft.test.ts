import { describe, expect, test } from 'vitest';

import type { Wishlist } from '@/api';
import {
  createWishlistInput,
  emptyItemDraft,
  emptyWishlistDraft,
  hasDraftErrors,
  isWebUrl,
  MAX_ITEMS_PER_WISHLIST,
  moveItem,
  normalizeItemUrl,
  updateWishlistInput,
  validateWishlistDraft,
  wishlistDraftOf,
  type WishlistDraft,
} from './wishlistDraft';

const childWishlist: Wishlist = {
  id: 'w1',
  participantId: 'ania',
  participantName: 'Ania',
  childName: 'Staś',
  notes: null,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  items: [
    {
      id: 'i1',
      title: 'Klocki',
      url: 'https://example.com/klocki',
      notes: null,
    },
    { id: 'i2', title: 'Książka', url: null, notes: 'o dinozaurach' },
  ],
};

const draftWith = (items: Partial<WishlistDraft['items'][number]>[]) => ({
  ...emptyWishlistDraft(),
  items: items.map((item) => ({ ...emptyItemDraft(), ...item })),
});

describe('wishlist draft', () => {
  test('a new wishlist starts with one empty gift idea', () => {
    const draft = emptyWishlistDraft();

    expect(draft.items).toHaveLength(1);
    expect(draft.items[0]).toMatchObject({ title: '', url: '', notes: '' });
  });

  test('new items get distinct keys', () => {
    expect(emptyItemDraft().key).not.toBe(emptyItemDraft().key);
  });

  test('edits a saved wishlist with its item ids', () => {
    expect(wishlistDraftOf(childWishlist)).toEqual({
      childName: 'Staś',
      notes: '',
      items: [
        {
          key: 'i1',
          id: 'i1',
          title: 'Klocki',
          url: 'https://example.com/klocki',
          notes: '',
        },
        {
          key: 'i2',
          id: 'i2',
          title: 'Książka',
          url: '',
          notes: 'o dinozaurach',
        },
      ],
    });
  });

  describe('moveItem', () => {
    test('moves an item up and down', () => {
      expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
      expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    });

    test('keeps the order at the ends of the list', () => {
      const items = ['a', 'b'];

      expect(moveItem(items, 0, -1)).toBe(items);
      expect(moveItem(items, 1, 1)).toBe(items);
    });
  });

  describe('links', () => {
    test('adds https:// to a bare address', () => {
      expect(normalizeItemUrl(' allegro.pl/oferta/1 ')).toBe(
        'https://allegro.pl/oferta/1',
      );
      expect(normalizeItemUrl('http://example.com')).toBe('http://example.com');
      expect(normalizeItemUrl('  ')).toBeNull();
    });

    test('accepts only web links', () => {
      expect(isWebUrl('https://example.com/a?b=1')).toBe(true);
      expect(isWebUrl('http://example.com')).toBe(true);
      expect(isWebUrl('javascript:alert(1)')).toBe(false);
      expect(isWebUrl('mailto:ania@example.com')).toBe(false);
      expect(isWebUrl('https://')).toBe(false);
    });
  });

  describe('validation', () => {
    test('a child wishlist needs the child name', () => {
      const draft = draftWith([{ title: 'Klocki' }]);

      expect(validateWishlistDraft(draft, { isChild: true }).childName).toBe(
        'required',
      );
      expect(
        hasDraftErrors(validateWishlistDraft(draft, { isChild: false })),
      ).toBe(false);
    });

    test('an item needs a title and a web link', () => {
      const draft = draftWith([
        { key: 'a', title: '', notes: 'coś ciepłego' },
        { key: 'b', title: 'Gra', url: 'ftp://example.com' },
        { key: 'c', title: 'Szalik', url: 'sklep.pl/szalik' },
      ]);

      const errors = validateWishlistDraft(draft, { isChild: false });

      expect(errors.items).toEqual({
        a: ['titleRequired'],
        b: ['urlInvalid'],
      });
      expect(hasDraftErrors(errors)).toBe(true);
    });

    test('ignores blank items', () => {
      const draft = draftWith([{ title: 'Szalik' }, {}]);

      expect(
        hasDraftErrors(validateWishlistDraft(draft, { isChild: false })),
      ).toBe(false);
    });

    test('limits the number of items', () => {
      const draft = draftWith(
        Array.from({ length: MAX_ITEMS_PER_WISHLIST + 1 }, (_, i) => ({
          title: `Pomysł ${i}`,
        })),
      );

      expect(
        validateWishlistDraft(draft, { isChild: false }).tooManyItems,
      ).toBe(true);
    });
  });

  describe('saving', () => {
    test('creates an own wishlist without a child name', () => {
      const draft = draftWith([
        { title: ' Szalik ', url: 'sklep.pl/szalik', notes: ' czerwony ' },
        {},
      ]);

      expect(createWishlistInput(draft, { isChild: false })).toEqual({
        notes: null,
        items: [
          {
            title: 'Szalik',
            url: 'https://sklep.pl/szalik',
            notes: 'czerwony',
          },
        ],
      });
    });

    test('creates a child wishlist', () => {
      const draft = { ...draftWith([]), childName: ' Staś ', notes: 'Lat 5' };

      expect(createWishlistInput(draft, { isChild: true })).toEqual({
        childName: 'Staś',
        notes: 'Lat 5',
        items: [],
      });
    });

    test('updates keep item ids in the new order so claims survive', () => {
      const draft = wishlistDraftOf(childWishlist);
      draft.items = moveItem(draft.items, 1, -1);
      draft.items.push({ ...emptyItemDraft(), title: 'Puzzle' });

      expect(updateWishlistInput(draft, { isChild: true })).toEqual({
        childName: 'Staś',
        notes: null,
        items: [
          { id: 'i2', title: 'Książka', url: null, notes: 'o dinozaurach' },
          {
            id: 'i1',
            title: 'Klocki',
            url: 'https://example.com/klocki',
            notes: null,
          },
          { title: 'Puzzle', url: null, notes: null },
        ],
      });
    });

    test('clears the notes of an own wishlist', () => {
      const draft = { ...draftWith([]), notes: '  ' };

      expect(updateWishlistInput(draft, { isChild: false })).toEqual({
        notes: null,
        items: [],
      });
    });
  });
});
