import { describe, expect, test, vi } from 'vitest';

import { ApiError, createApiClient, type MyAssignment } from '@/api';
import { fakeFetch, requestHeaders, type FakeResponse } from '@/test/fakeFetch';
import {
  actingAsFromQuery,
  loadAssignmentState,
  printLocation,
  safeLink,
} from './myAssignment';

const assignment: MyAssignment = {
  recipient: { id: 'babcia', displayName: 'Babcia Zosia' },
  wishlist: {
    id: 'wishlist-1',
    participantId: 'babcia',
    participantName: 'Babcia Zosia',
    childName: null,
    notes: 'Lubię ciepłe rzeczy.',
    createdAt: '2026-10-16T10:00:00.000Z',
    updatedAt: '2026-10-16T10:00:00.000Z',
    items: [
      { id: 'item-1', title: 'Szal', url: null, notes: 'Czerwony' },
      {
        id: 'item-2',
        title: 'Kryminał',
        url: 'https://example.com/ksiazka',
        notes: null,
      },
    ],
  },
};

const setup = (...responses: FakeResponse[]) => {
  const fetch = fakeFetch(...responses);
  const client = createApiClient({
    getToken: () => 'magic-token',
    onUnauthorized: vi.fn(),
    fetch,
  });
  return { client, fetch };
};

describe('loading my assignment', () => {
  test('shows the recipient and their wishlist after the draw', async () => {
    const { client, fetch } = setup({ body: assignment });

    const state = await loadAssignmentState(
      { id: 'event-1', status: 'drawn' },
      null,
      client,
    );

    expect(state).toEqual({ kind: 'assigned', assignment });
    expect(fetch).toHaveBeenCalledWith(
      '/api/events/event-1/my-assignment',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(requestHeaders(fetch)).not.toHaveProperty('X-Acting-As');
  });

  test('a caretaker asks for their managed participant’s assignment', async () => {
    const { client, fetch } = setup({ body: assignment });

    await loadAssignmentState(
      { id: 'event-1', status: 'drawn' },
      'babcia',
      client,
    );

    expect(requestHeaders(fetch)).toMatchObject({ 'X-Acting-As': 'babcia' });
  });

  test('is still readable once the event is finished', async () => {
    const { client } = setup({ body: assignment });

    const state = await loadAssignmentState(
      { id: 'event-1', status: 'finished' },
      null,
      client,
    );

    expect(state.kind).toBe('assigned');
  });

  test('does not ask before the draw', async () => {
    const { client, fetch } = setup({ body: assignment });

    const state = await loadAssignmentState(
      { id: 'event-1', status: 'open' },
      null,
      client,
    );

    expect(state).toEqual({ kind: 'notDrawn' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('a participant who declined before the draw has no assignment', async () => {
    const { client } = setup({
      status: 404,
      body: { error: 'No assignment' },
    });

    const state = await loadAssignmentState(
      { id: 'event-1', status: 'drawn' },
      null,
      client,
    );

    expect(state).toEqual({ kind: 'none' });
  });

  test('passes other failures on', async () => {
    const { client } = setup({ status: 403, body: { error: 'Forbidden' } });

    await expect(
      loadAssignmentState({ id: 'event-1', status: 'drawn' }, 'jan', client),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe('print view location', () => {
  test('carries the managed participant in the query', () => {
    expect(printLocation('event-1', 'babcia')).toEqual({
      name: 'event-assignment-print',
      params: { eventId: 'event-1' },
      query: { as: 'babcia' },
    });
  });

  test('has no query when printing for oneself', () => {
    expect(printLocation('event-1', null)).toMatchObject({ query: {} });
  });

  test('reads the managed participant back from the query', () => {
    expect(actingAsFromQuery('babcia')).toBe('babcia');
    expect(actingAsFromQuery(['babcia', 'dziadek'])).toBe('babcia');
    expect(actingAsFromQuery(undefined)).toBeNull();
    expect(actingAsFromQuery(null)).toBeNull();
    expect(actingAsFromQuery('')).toBeNull();
  });
});

describe('wishlist item links', () => {
  test('links web addresses', () => {
    expect(safeLink('https://example.com/ksiazka')?.hostname).toBe(
      'example.com',
    );
    expect(safeLink('http://example.com')?.href).toBe('http://example.com/');
  });

  test('does not link anything else', () => {
    expect(safeLink(null)).toBeNull();
    expect(safeLink('')).toBeNull();
    expect(safeLink('not a url')).toBeNull();
    expect(safeLink('javascript:alert(1)')).toBeNull();
  });
});
