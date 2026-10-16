import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';

import {
  connectApi,
  type EventDetails,
  type MyClaim,
  type Wishlist,
} from '@/api';
import { fakeFetch, requestHeaders } from '@/test/fakeFetch';
import { useAuthStore } from './auth';
import { useEventsStore } from './events';
import { useWishlistsStore } from './wishlists';

const babcia = {
  id: 'babcia',
  displayName: 'Babcia Zosia',
  role: 'member',
  status: 'active',
} as const;

const eventDetails: EventDetails = {
  id: 'event-1',
  title: 'Wigilia u Kowalskich',
  description: null,
  budgetAmount: null,
  budgetCurrency: null,
  rules: null,
  timezone: 'Europe/Warsaw',
  exchangeOn: '2026-12-24',
  status: 'open',
  drawnAt: null,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
  myParticipant: { id: 'ania', role: 'member', status: 'active' },
  participants: [
    { id: 'jan', displayName: 'Jan', role: 'organizer', status: 'active' },
    { id: 'ania', displayName: 'Ania', role: 'member', status: 'active' },
    babcia,
  ],
  managedParticipants: [babcia],
};

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
const zosia = wishlist({
  id: 'zosia',
  participantId: 'jan',
  participantName: 'Jan',
  childName: 'Zosia',
  items: [
    {
      id: 'klocki',
      title: 'Klocki',
      url: null,
      notes: null,
      claimedByMe: false,
      claimedBy: null,
    },
  ],
});

const myClaim: MyClaim = {
  wishlistId: 'zosia',
  childName: 'Zosia',
  parentName: 'Jan',
  claimedAt: '2026-10-16T11:00:00.000Z',
  item: { id: 'klocki', title: 'Klocki', url: null, notes: null },
};

// Signs in and loads `eventDetails`; the given responses follow.
const setup = async (...responses: Parameters<typeof fakeFetch>) => {
  setActivePinia(createPinia());
  localStorage.setItem('secret-santa.magicToken', 'magic-token');
  connectApi(useAuthStore(), { replace: vi.fn() });
  const fetch = fakeFetch({ body: eventDetails }, ...responses);
  vi.stubGlobal('fetch', fetch);
  const events = useEventsStore();
  await events.loadEvent('event-1');
  return { events, wishlists: useWishlistsStore(), fetch };
};

const lastRequest = (fetch: ReturnType<typeof fakeFetch>) => {
  const index = fetch.mock.calls.length - 1;
  const [url, init] = fetch.mock.calls[index]!;
  return {
    url,
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
    headers: requestHeaders(fetch, index),
  };
};

describe('wishlists store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loads and groups the wishlists', async () => {
    const { wishlists, fetch } = await setup({ body: [own, zosia] });

    await wishlists.loadWishlists();

    expect(lastRequest(fetch)).toMatchObject({
      url: '/api/events/event-1/wishlists',
      method: 'GET',
    });
    expect(lastRequest(fetch).headers).not.toHaveProperty('X-Acting-As');
    expect(wishlists.groups).toEqual({
      own,
      myChildren: [],
      otherChildren: [zosia],
    });
  });

  test('loads as the managed participant a caretaker acts as', async () => {
    const { events, wishlists, fetch } = await setup({ body: [] });
    events.actAs('babcia');

    await wishlists.loadWishlists();

    expect(lastRequest(fetch).headers['X-Acting-As']).toBe('babcia');
  });

  test('hides wishlists loaded for another profile', async () => {
    const { events, wishlists } = await setup({ body: [own, zosia] });
    await wishlists.loadWishlists();

    events.actAs('babcia');

    expect(wishlists.wishlists).toBeNull();
    events.actAs(null);
    expect(wishlists.wishlists).toEqual([own, zosia]);
  });

  test('drops a response for a profile switched away from', async () => {
    const { events, wishlists } = await setup({ body: [own] });

    const loading = wishlists.loadWishlists();
    events.actAs('babcia');
    await loading;

    events.actAs(null);
    expect(wishlists.wishlists).toBeNull();
  });

  test('the person counts as the parent of their and managed children', async () => {
    const { wishlists } = await setup();

    expect([...wishlists.familyParticipantIds]).toEqual(['ania', 'babcia']);
  });

  describe('editing', () => {
    test('creates the own wishlist first', async () => {
      const { wishlists, fetch } = await setup(
        { body: [zosia] },
        { body: own },
      );
      await wishlists.loadWishlists();

      await wishlists.createWishlist({ items: [{ title: 'Szalik' }] });

      expect(lastRequest(fetch)).toMatchObject({
        url: '/api/events/event-1/wishlists',
        method: 'POST',
        body: { items: [{ title: 'Szalik' }] },
      });
      expect(wishlists.wishlists).toEqual([own, zosia]);
    });

    test('adds a child wishlist last', async () => {
      const stas = wishlist({ id: 'stas', childName: 'Staś' });
      const { wishlists } = await setup({ body: [own, zosia] }, { body: stas });
      await wishlists.loadWishlists();

      await wishlists.createWishlist({ childName: 'Staś' });

      expect(wishlists.groups?.myChildren).toEqual([stas]);
      expect(wishlists.wishlists?.at(-1)).toEqual(stas);
    });

    test('updates a wishlist as a caretaker', async () => {
      const babciaOwn = wishlist({ id: 'b', participantId: 'babcia' });
      const updated = { ...babciaOwn, notes: 'Rozmiar M' };
      const { events, wishlists, fetch } = await setup(
        { body: [babciaOwn] },
        { body: updated },
      );
      events.actAs('babcia');
      await wishlists.loadWishlists();

      await wishlists.updateWishlist('b', { notes: 'Rozmiar M' });

      expect(lastRequest(fetch)).toMatchObject({
        url: '/api/events/event-1/wishlists/b',
        method: 'PATCH',
        headers: { 'X-Acting-As': 'babcia' },
      });
      expect(wishlists.groups?.own).toEqual(updated);
    });

    test('deletes a wishlist', async () => {
      const { wishlists, fetch } = await setup(
        { body: [own, zosia] },
        { status: 204 },
      );
      await wishlists.loadWishlists();

      await wishlists.deleteWishlist('own');

      expect(lastRequest(fetch)).toMatchObject({
        url: '/api/events/event-1/wishlists/own',
        method: 'DELETE',
      });
      expect(wishlists.wishlists).toEqual([zosia]);
    });
  });

  describe('claims', () => {
    test('claims an item in the acting participant name', async () => {
      const { events, wishlists, fetch } = await setup(
        { body: [zosia] },
        { body: [] },
        { body: myClaim },
      );
      events.actAs('babcia');
      await wishlists.loadWishlists();
      await wishlists.loadMyClaims();

      await wishlists.claim('klocki');

      expect(lastRequest(fetch)).toMatchObject({
        url: '/api/events/event-1/wishlist-items/klocki/claim',
        method: 'PUT',
        headers: { 'X-Acting-As': 'babcia' },
      });
      expect(wishlists.wishlists?.[0]?.items[0]).toMatchObject({
        claimedByMe: true,
        claimedBy: 'Babcia Zosia',
      });
      expect(wishlists.myClaims).toEqual([myClaim]);
    });

    test('reloads to show who was faster', async () => {
      const takenByJan = {
        ...zosia,
        items: [{ ...zosia.items[0]!, claimedBy: 'Jan' }],
      };
      const { wishlists } = await setup(
        { body: [zosia] },
        { status: 409, body: { error: 'Already claimed' } },
        { body: [takenByJan] },
      );
      await wishlists.loadWishlists();

      await expect(wishlists.claim('klocki')).rejects.toMatchObject({
        kind: 'conflict',
      });

      expect(wishlists.wishlists).toEqual([takenByJan]);
    });

    test('releases a claim', async () => {
      const claimed = {
        ...zosia,
        items: [{ ...zosia.items[0]!, claimedByMe: true, claimedBy: 'Ania' }],
      };
      const { wishlists, fetch } = await setup(
        { body: [claimed] },
        { body: [myClaim] },
        { status: 204 },
      );
      await wishlists.loadWishlists();
      await wishlists.loadMyClaims();

      await wishlists.releaseClaim('klocki');

      expect(lastRequest(fetch)).toMatchObject({
        url: '/api/events/event-1/wishlist-items/klocki/claim',
        method: 'DELETE',
      });
      expect(wishlists.wishlists?.[0]?.items[0]).toMatchObject({
        claimedByMe: false,
        claimedBy: null,
      });
      expect(wishlists.myClaims).toEqual([]);
    });

    test('loads my claims', async () => {
      const { wishlists, fetch } = await setup({ body: [myClaim] });

      await wishlists.loadMyClaims();

      expect(lastRequest(fetch).url).toBe('/api/events/event-1/my-claims');
      expect(wishlists.myClaims).toEqual([myClaim]);
    });
  });

  test('forgets everything when the person signs out', async () => {
    const { events, wishlists } = await setup(
      { body: [own] },
      { body: eventDetails },
    );
    await wishlists.loadWishlists();

    useAuthStore().signOut();
    await nextTick();
    await events.loadEvent('event-1');

    expect(wishlists.wishlists).toBeNull();
  });
});
