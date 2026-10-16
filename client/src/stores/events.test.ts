import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { nextTick } from 'vue';

import { connectApi, type EventDetails, type MyEvent } from '@/api';
import { fakeFetch, requestHeaders } from '@/test/fakeFetch';
import { useAuthStore } from './auth';
import { useEventsStore } from './events';

const baseEvent = {
  id: 'event-1',
  title: 'Wigilia u Kowalskich',
  description: null,
  budgetAmount: 15000,
  budgetCurrency: 'PLN',
  rules: null,
  timezone: 'Europe/Warsaw',
  exchangeOn: '2026-12-24',
  status: 'open',
  drawnAt: null,
  createdAt: '2026-10-16T10:00:00.000Z',
  updatedAt: '2026-10-16T10:00:00.000Z',
} as const;

const myEvent: MyEvent = {
  ...baseEvent,
  myParticipant: { id: 'ania', role: 'member', status: 'active' },
};

const babcia = {
  id: 'babcia',
  displayName: 'Babcia Zosia',
  role: 'member',
  status: 'active',
} as const;

const eventDetails: EventDetails = {
  ...myEvent,
  participants: [
    { id: 'jan', displayName: 'Jan', role: 'organizer', status: 'active' },
    { id: 'ania', displayName: 'Ania', role: 'member', status: 'active' },
    babcia,
  ],
  managedParticipants: [babcia],
};

const setupEvents = (...responses: Parameters<typeof fakeFetch>) => {
  setActivePinia(createPinia());
  localStorage.setItem('secret-santa.magicToken', 'magic-token');
  const auth = useAuthStore();
  connectApi(auth, { replace: vi.fn() });
  const fetch = fakeFetch(...responses);
  vi.stubGlobal('fetch', fetch);
  return { events: useEventsStore(), auth, fetch };
};

const lastRequest = (fetch: ReturnType<typeof fakeFetch>) => {
  const index = fetch.mock.calls.length - 1;
  const [url, init] = fetch.mock.calls[index]!;
  return { url, method: init?.method, headers: requestHeaders(fetch, index) };
};

describe('events store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loads my events', async () => {
    const { events, fetch } = setupEvents({ body: [myEvent] });

    await events.loadMyEvents();

    expect(events.myEvents).toEqual([myEvent]);
    expect(lastRequest(fetch)).toMatchObject({
      url: '/api/events',
      method: 'GET',
    });
  });

  test('loads an event', async () => {
    const { events, fetch } = setupEvents({ body: eventDetails });

    await events.loadEvent('event-1');

    expect(events.event).toEqual(eventDetails);
    expect(lastRequest(fetch).url).toBe('/api/events/event-1');
  });

  test('forgets the previous event while loading another one', async () => {
    const { events } = setupEvents({ body: eventDetails }, { status: 404 });
    await events.loadEvent('event-1');

    await expect(events.loadEvent('event-2')).rejects.toMatchObject({
      kind: 'notFound',
    });

    expect(events.event).toBeNull();
  });

  describe('profile switcher', () => {
    test('acts as oneself by default', async () => {
      const { events } = setupEvents({ body: eventDetails });
      await events.loadEvent('event-1');

      expect(events.actingParticipant).toEqual({
        id: 'ania',
        displayName: 'Ania',
        role: 'member',
        status: 'active',
        isSelf: true,
      });
      expect(events.actingAs).toBeNull();
      expect(events.requestHeaders).toEqual({});
    });

    test('a caretaker acts as their managed participant', async () => {
      const { events } = setupEvents({ body: eventDetails });
      await events.loadEvent('event-1');

      events.actAs('babcia');

      expect(events.actingParticipant).toEqual({ ...babcia, isSelf: false });
      expect(events.actingAs).toBe('babcia');
      expect(events.requestHeaders).toEqual({ 'X-Acting-As': 'babcia' });
    });

    test('switches back to oneself', async () => {
      const { events } = setupEvents({ body: eventDetails });
      await events.loadEvent('event-1');
      events.actAs('babcia');

      events.actAs(null);

      expect(events.actingParticipant?.isSelf).toBe(true);
    });

    test('cannot act as a participant one is not the caretaker of', async () => {
      const { events } = setupEvents({ body: eventDetails });
      await events.loadEvent('event-1');

      events.actAs('jan');

      expect(events.actingAs).toBeNull();
    });

    test('keeps the profile per event', async () => {
      const otherEvent = { ...eventDetails, id: 'event-2' };
      const { events } = setupEvents(
        { body: eventDetails },
        { body: otherEvent },
        { body: eventDetails },
      );
      await events.loadEvent('event-1');
      events.actAs('babcia');

      await events.loadEvent('event-2');
      expect(events.actingAs).toBeNull();

      await events.loadEvent('event-1');
      expect(events.actingAs).toBe('babcia');
    });

    test('drops the profile once the person is no longer the caretaker', async () => {
      const { events } = setupEvents(
        { body: eventDetails },
        { body: { ...eventDetails, managedParticipants: [] } },
      );
      await events.loadEvent('event-1');
      events.actAs('babcia');

      await events.loadEvent('event-1');

      expect(events.actingAs).toBeNull();
      expect(events.actingAsByEvent).toEqual({});
    });
  });

  describe('decline and rejoin', () => {
    test('declines as oneself', async () => {
      const declined = {
        id: 'ania',
        displayName: 'Ania',
        role: 'member',
        status: 'declined',
      };
      const { events, fetch } = setupEvents(
        { body: [myEvent] },
        { body: eventDetails },
        { body: declined },
      );
      await events.loadMyEvents();
      await events.loadEvent('event-1');

      await events.decline();

      expect(lastRequest(fetch)).toMatchObject({
        url: '/api/events/event-1/participation/decline',
        method: 'POST',
      });
      expect(lastRequest(fetch).headers).not.toHaveProperty('X-Acting-As');
      expect(events.event?.myParticipant.status).toBe('declined');
      expect(events.actingParticipant?.status).toBe('declined');
      expect(
        events.event?.participants.find(({ id }) => id === 'ania')?.status,
      ).toBe('declined');
      expect(events.myEvents?.[0]?.myParticipant.status).toBe('declined');
    });

    test('a caretaker declines for their managed participant', async () => {
      const { events, fetch } = setupEvents(
        { body: eventDetails },
        { body: { ...babcia, status: 'declined' } },
      );
      await events.loadEvent('event-1');
      events.actAs('babcia');

      await events.decline();

      expect(lastRequest(fetch).headers['X-Acting-As']).toBe('babcia');
      expect(events.actingParticipant?.status).toBe('declined');
      expect(events.event?.myParticipant.status).toBe('active');
      expect(
        events.event?.participants.find(({ id }) => id === 'babcia')?.status,
      ).toBe('declined');
    });

    test('rejoins', async () => {
      const declinedEvent: EventDetails = {
        ...eventDetails,
        myParticipant: { id: 'ania', role: 'member', status: 'declined' },
      };
      const { events, fetch } = setupEvents(
        { body: declinedEvent },
        {
          body: {
            id: 'ania',
            displayName: 'Ania',
            role: 'member',
            status: 'active',
          },
        },
      );
      await events.loadEvent('event-1');

      await events.rejoin();

      expect(lastRequest(fetch).url).toBe(
        '/api/events/event-1/participation/rejoin',
      );
      expect(events.event?.myParticipant.status).toBe('active');
    });

    test('keeps the status when declining fails', async () => {
      const { events } = setupEvents(
        { body: eventDetails },
        {
          status: 409,
          body: { error: 'Not allowed while the event is drawn' },
        },
      );
      await events.loadEvent('event-1');

      await expect(events.decline()).rejects.toMatchObject({
        kind: 'conflict',
      });

      expect(events.event?.myParticipant.status).toBe('active');
    });
  });

  test('forgets everything when the person signs out', async () => {
    const { events, auth } = setupEvents(
      { body: [myEvent] },
      { body: eventDetails },
    );
    await events.loadMyEvents();
    await events.loadEvent('event-1');
    events.actAs('babcia');

    auth.signOut();
    await nextTick();

    expect(events.myEvents).toBeNull();
    expect(events.event).toBeNull();
    expect(events.actingAsByEvent).toEqual({});
  });
});
