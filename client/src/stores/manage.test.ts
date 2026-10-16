import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { connectApi, type EventDetails, type Exclusion } from '@/api';
import { fakeFetch } from '@/test/fakeFetch';
import { ania, babcia, jan, piotr } from '@/test/organizerParticipants';
import { useAuthStore } from './auth';
import { useEventsStore } from './events';
import { useManageStore } from './manage';

const eventDetails: EventDetails = {
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
  myParticipant: { id: 'jan', role: 'organizer', status: 'active' },
  participants: [jan, ania, babcia].map(
    ({ id, displayName, role, status }) => ({ id, displayName, role, status }),
  ),
  managedParticipants: [],
};

const builtIn: Exclusion = {
  participantAId: 'ania',
  participantBId: 'babcia',
  builtIn: true,
};

const setupManage = (...responses: Parameters<typeof fakeFetch>) => {
  setActivePinia(createPinia());
  localStorage.setItem('secret-santa.magicToken', 'magic-token');
  connectApi(useAuthStore(), { replace: vi.fn() });
  const fetch = fakeFetch(...responses);
  vi.stubGlobal('fetch', fetch);
  return { manage: useManageStore(), events: useEventsStore(), fetch };
};

// Loads the manage page of event-1, then answers with `responses`.
const loadedManage = async (...responses: Parameters<typeof fakeFetch>) => {
  const setup = setupManage(
    { body: [jan, ania, babcia] },
    { body: [builtIn] },
    ...responses,
  );
  await setup.manage.load('event-1');
  return setup;
};

const request = (fetch: ReturnType<typeof fakeFetch>, call: number) => {
  const [url, init] = fetch.mock.calls[call]!;
  return {
    url,
    method: init?.method,
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  };
};

describe('manage store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loads the participants and exclusions', async () => {
    const { manage, fetch } = await loadedManage();

    expect(manage.eventId).toBe('event-1');
    expect(manage.participants).toEqual([jan, ania, babcia]);
    expect(manage.exclusions).toEqual([builtIn]);
    expect(request(fetch, 0).url).toBe('/api/events/event-1/participants');
    expect(request(fetch, 1).url).toBe('/api/events/event-1/exclusions');
  });

  test('forgets another event while loading', async () => {
    const { manage } = await loadedManage({ status: 404 });

    await expect(manage.load('event-2')).rejects.toMatchObject({
      kind: 'notFound',
    });

    expect(manage.participants).toBeNull();
    expect(manage.exclusions).toBeNull();
  });

  test('updates the event and reloads it', async () => {
    const { manage, events, fetch } = await loadedManage(
      { body: { ...eventDetails, title: 'Wigilia 2026' } },
      { body: { ...eventDetails, title: 'Wigilia 2026' } },
    );

    await manage.updateEvent({ title: 'Wigilia 2026' });

    expect(request(fetch, 2)).toEqual({
      url: '/api/events/event-1',
      method: 'PATCH',
      body: { title: 'Wigilia 2026' },
    });
    expect(request(fetch, 3)).toMatchObject({
      url: '/api/events/event-1',
      method: 'GET',
    });
    expect(events.event?.title).toBe('Wigilia 2026');
  });

  test('deletes the event', async () => {
    const { manage, events, fetch } = await loadedManage({ status: 204 });
    events.myEvents = [eventDetails];

    await manage.deleteEvent();

    expect(request(fetch, 2)).toMatchObject({
      url: '/api/events/event-1',
      method: 'DELETE',
    });
    expect(events.myEvents).toEqual([]);
    expect(manage.eventId).toBeNull();
  });

  test('adds a participant with an email', async () => {
    const { manage, fetch } = await loadedManage(
      { status: 201, body: piotr },
      { body: eventDetails },
    );

    await manage.addParticipant({
      displayName: 'Piotr',
      email: 'piotr@example.com',
    });

    expect(request(fetch, 2)).toEqual({
      url: '/api/events/event-1/participants',
      method: 'POST',
      body: { displayName: 'Piotr', email: 'piotr@example.com' },
    });
    expect(manage.participants).toEqual([jan, ania, babcia, piotr]);
    expect(request(fetch, 3).url).toBe('/api/events/event-1');
  });

  test('adding a managed participant brings their built-in exclusion', async () => {
    const dziadek = {
      ...babcia,
      id: 'dziadek',
      displayName: 'Dziadek',
      managedByParticipantId: 'jan',
    };
    const dziadekPair = {
      participantAId: 'dziadek',
      participantBId: 'jan',
      builtIn: true,
    };
    const { manage, fetch } = await loadedManage(
      { status: 201, body: dziadek },
      { body: [builtIn, dziadekPair] },
      { body: eventDetails },
    );

    await manage.addParticipant({
      displayName: 'Dziadek',
      managedByParticipantId: 'jan',
    });

    expect(request(fetch, 2).body).toEqual({
      displayName: 'Dziadek',
      managedByParticipantId: 'jan',
    });
    expect(manage.exclusions).toEqual([builtIn, dziadekPair]);
  });

  test('removes a participant with their exclusions', async () => {
    const { manage, fetch } = await loadedManage(
      { status: 204 },
      { body: eventDetails },
    );

    await manage.removeParticipant('babcia');

    expect(request(fetch, 2)).toMatchObject({
      url: '/api/events/event-1/participants/babcia',
      method: 'DELETE',
    });
    expect(manage.participants).toEqual([jan, ania]);
    expect(manage.exclusions).toEqual([]);
  });

  test('sends the pending invitations and reloads the participants', async () => {
    const invitedPiotr = { ...piotr, inviteSentAt: '2026-10-16T12:00:00Z' };
    const { manage, fetch } = await loadedManage(
      { body: { sent: 1 } },
      { body: [jan, ania, invitedPiotr] },
    );

    await expect(manage.sendPendingInvitations()).resolves.toBe(1);

    expect(request(fetch, 2)).toMatchObject({
      url: '/api/events/event-1/invitations/send',
      method: 'POST',
    });
    expect(manage.participants).toEqual([jan, ania, invitedPiotr]);
  });

  test('sends one invitation', async () => {
    const { manage, fetch } = await loadedManage({
      body: { participantId: 'ania', inviteSentAt: '2026-10-17T09:00:00Z' },
    });

    await manage.sendInvitation('ania');

    expect(request(fetch, 2)).toMatchObject({
      url: '/api/events/event-1/participants/ania/invitation',
      method: 'POST',
    });
    expect(
      manage.participants?.find(({ id }) => id === 'ania')?.inviteSentAt,
    ).toBe('2026-10-17T09:00:00Z');
  });

  test('adds an exclusion with the smaller id first', async () => {
    const pair = {
      participantAId: 'ania',
      participantBId: 'jan',
      builtIn: false,
    };
    const { manage, fetch } = await loadedManage({ status: 201, body: pair });

    await manage.addExclusion('jan', 'ania');

    expect(request(fetch, 2)).toEqual({
      url: '/api/events/event-1/exclusions',
      method: 'POST',
      body: { participantAId: 'ania', participantBId: 'jan' },
    });
    expect(manage.exclusions).toEqual([builtIn, pair]);
  });

  test('removes an exclusion', async () => {
    const pair = {
      participantAId: 'ania',
      participantBId: 'jan',
      builtIn: false,
    };
    const { manage, fetch } = await loadedManage(
      { status: 201, body: pair },
      { status: 204 },
    );
    await manage.addExclusion('ania', 'jan');

    await manage.removeExclusion(pair);

    expect(request(fetch, 3)).toMatchObject({
      url: '/api/events/event-1/exclusions/ania/jan',
      method: 'DELETE',
    });
    expect(manage.exclusions).toEqual([builtIn]);
  });

  test('runs the draw and reloads the event', async () => {
    const drawn = { ...eventDetails, status: 'drawn' as const };
    const { manage, events, fetch } = await loadedManage(
      { body: { event: drawn, participantCount: 3 } },
      { body: drawn },
    );

    await expect(manage.runDraw()).resolves.toMatchObject({
      participantCount: 3,
    });

    expect(request(fetch, 2)).toMatchObject({
      url: '/api/events/event-1/draw',
      method: 'POST',
    });
    expect(events.event?.status).toBe('drawn');
  });

  test('a failed draw refreshes the participants', async () => {
    const declinedAnia = { ...ania, status: 'declined' as const };
    const { manage } = await loadedManage(
      { status: 422, body: { error: 'too few' } },
      { body: [jan, declinedAnia, babcia] },
    );

    await expect(manage.runDraw()).rejects.toMatchObject({
      kind: 'unprocessable',
    });

    expect(manage.participants).toEqual([jan, declinedAnia, babcia]);
  });
});
