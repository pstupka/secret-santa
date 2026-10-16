import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';

import { connectApi, type EventDetails } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { useEventsStore } from '@/stores/events';
import { fakeFetch } from '@/test/fakeFetch';
import { requireOrganizer } from './requireOrganizer';

const eventAs = (role: 'organizer' | 'member'): EventDetails => ({
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
  myParticipant: { id: 'me', role, status: 'active' },
  participants: [],
  managedParticipants: [],
});

const manageRoute = {
  name: 'event-manage',
  params: { eventId: 'event-1' },
} as unknown as RouteLocationNormalized;

const guard = () =>
  requireOrganizer.call(undefined, manageRoute, manageRoute, vi.fn());

const setup = (...responses: Parameters<typeof fakeFetch>) => {
  setActivePinia(createPinia());
  localStorage.setItem('secret-santa.magicToken', 'magic-token');
  connectApi(useAuthStore(), { replace: vi.fn() });
  const fetch = fakeFetch(...responses);
  vi.stubGlobal('fetch', fetch);
  return { events: useEventsStore(), fetch };
};

describe('requireOrganizer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('lets the organizer in', async () => {
    const { events, fetch } = setup({ body: eventAs('organizer') });
    await events.loadEvent('event-1');

    await expect(guard()).resolves.toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test('sends anyone else to the event dashboard', async () => {
    const { events } = setup({ body: eventAs('member') });
    await events.loadEvent('event-1');

    await expect(guard()).resolves.toEqual({
      name: 'event',
      params: { eventId: 'event-1' },
    });
  });

  test('loads the event when it is not loaded yet', async () => {
    const { fetch } = setup({ body: eventAs('member') });

    await expect(guard()).resolves.toMatchObject({ name: 'event' });
    expect(fetch).toHaveBeenCalledWith(
      '/api/events/event-1',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  test('lets the layout show a load error', async () => {
    setup({ status: 404 });

    await expect(guard()).resolves.toBe(true);
  });
});
