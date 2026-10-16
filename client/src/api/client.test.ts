import { describe, expect, test, vi } from 'vitest';

import { fakeFetch, requestHeaders } from '@/test/fakeFetch';
import { ApiError, createApiClient } from './client';

const setup = ({
  token = null as string | null,
  responses = [{ body: {} }] as Parameters<typeof fakeFetch>,
} = {}) => {
  const fetch = fakeFetch(...responses);
  const onUnauthorized = vi.fn();
  const api = createApiClient({ getToken: () => token, onUnauthorized, fetch });
  return { api, fetch, onUnauthorized };
};

const rejection = async (promise: Promise<unknown>): Promise<ApiError> => {
  const error = await promise.then(
    () => {
      throw new Error('expected the request to fail');
    },
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
};

describe('api client', () => {
  describe('magic token', () => {
    test('attaches the stored magic token as a bearer token', async () => {
      const { api, fetch } = setup({
        token: 'magic-token',
        responses: [{ body: { id: 'p1', email: 'ania@example.com' } }],
      });

      const person = await api.getMe();

      expect(person).toEqual({ id: 'p1', email: 'ania@example.com' });
      expect(fetch).toHaveBeenCalledWith(
        '/api/me',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(requestHeaders(fetch).Authorization).toBe('Bearer magic-token');
    });

    test('sends no Authorization header without a magic token', async () => {
      const { api, fetch } = setup();

      await api.request('GET', '/health');

      expect(requestHeaders(fetch)).not.toHaveProperty('Authorization');
    });

    test('reads the magic token at request time', async () => {
      let token: string | null = null;
      const fetch = fakeFetch({ body: {} });
      const api = createApiClient({
        getToken: () => token,
        onUnauthorized: vi.fn(),
        fetch,
      });

      await api.request('GET', '/health');
      token = 'later-token';
      await api.request('GET', '/health');

      expect(requestHeaders(fetch, 0)).not.toHaveProperty('Authorization');
      expect(requestHeaders(fetch, 1).Authorization).toBe('Bearer later-token');
    });

    test('passes extra headers, e.g. X-Acting-As for a caretaker', async () => {
      const { api, fetch } = setup({ token: 'magic-token' });

      await api.request('GET', '/events/e1', {
        headers: { 'X-Acting-As': 'participant-1' },
      });

      expect(requestHeaders(fetch)).toMatchObject({
        Authorization: 'Bearer magic-token',
        'X-Acting-As': 'participant-1',
      });
    });
  });

  describe('requests', () => {
    test('creates an event with a JSON body', async () => {
      const event = { id: 'e1', title: 'Wigilia' };
      const { api, fetch } = setup({
        responses: [{ status: 201, body: event }],
      });
      const input = {
        title: 'Wigilia',
        timezone: 'Europe/Warsaw',
        exchangeOn: '2026-12-24',
        organizerName: 'Ania',
        organizerEmail: 'ania@example.com',
      };

      await expect(api.createEvent(input)).resolves.toEqual(event);

      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('/api/events');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual(input);
      expect(requestHeaders(fetch)['Content-Type']).toBe('application/json');
    });

    test('requests a personal link by email', async () => {
      const { api, fetch } = setup({
        responses: [{ status: 202, body: { message: 'sent' } }],
      });

      await api.requestAccessLink('ania@example.com');

      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('/api/access-links');
      expect(JSON.parse(String(init?.body))).toEqual({
        email: 'ania@example.com',
      });
    });

    test('declines as oneself without X-Acting-As', async () => {
      const { api, fetch } = setup({ token: 'magic-token' });

      await api.declineParticipation('e1');

      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('/api/events/e1/participation/decline');
      expect(init?.method).toBe('POST');
      expect(requestHeaders(fetch)).not.toHaveProperty('X-Acting-As');
    });

    test('a caretaker rejoins for a managed participant with X-Acting-As', async () => {
      const { api, fetch } = setup({ token: 'magic-token' });

      await api.rejoinParticipation('e1', 'babcia');

      expect(fetch.mock.calls[0]![0]).toBe(
        '/api/events/e1/participation/rejoin',
      );
      expect(requestHeaders(fetch)['X-Acting-As']).toBe('babcia');
    });

    test('updates a wishlist with its items as a caretaker', async () => {
      const { api, fetch } = setup({ token: 'magic-token' });
      const input = { items: [{ id: 'i1', title: 'Szalik' }] };

      await api.updateWishlist('e1', 'w1', input, 'babcia');

      const [url, init] = fetch.mock.calls[0]!;
      expect(url).toBe('/api/events/e1/wishlists/w1');
      expect(init?.method).toBe('PATCH');
      expect(JSON.parse(String(init?.body))).toEqual(input);
      expect(requestHeaders(fetch)['X-Acting-As']).toBe('babcia');
    });

    test('claims and releases a child wishlist item', async () => {
      const { api, fetch } = setup({
        token: 'magic-token',
        responses: [{ body: {} }, { status: 204 }],
      });

      await api.claimWishlistItem('e1', 'i1');
      await api.releaseClaim('e1', 'i1');

      expect(
        fetch.mock.calls.map(([url, init]) => [url, init?.method]),
      ).toEqual([
        ['/api/events/e1/wishlist-items/i1/claim', 'PUT'],
        ['/api/events/e1/wishlist-items/i1/claim', 'DELETE'],
      ]);
    });

    test('resolves with undefined for a response without a body', async () => {
      const { api } = setup({ responses: [{ status: 204 }] });

      await expect(
        api.request('DELETE', '/events/e1'),
      ).resolves.toBeUndefined();
    });
  });

  describe('401', () => {
    test('reports the invalid magic token and rejects', async () => {
      const { api, onUnauthorized } = setup({
        token: 'expired-token',
        responses: [{ status: 401, body: { error: 'Unauthorized' } }],
      });

      const error = await rejection(api.getMe());

      expect(error.kind).toBe('unauthorized');
      expect(error.status).toBe(401);
      expect(onUnauthorized).toHaveBeenCalledOnce();
    });

    test('is the only status that reports an invalid magic token', async () => {
      const { api, onUnauthorized } = setup({
        token: 'magic-token',
        responses: [{ status: 403, body: { error: 'Forbidden' } }],
      });

      await rejection(api.getMe());

      expect(onUnauthorized).not.toHaveBeenCalled();
    });
  });

  describe('errors', () => {
    test.each([
      [400, 'validation'],
      [403, 'forbidden'],
      [404, 'notFound'],
      [409, 'conflict'],
      [422, 'unprocessable'],
      [429, 'rateLimited'],
      [500, 'server'],
      [502, 'server'],
    ] as const)('maps %i to %s', async (status, kind) => {
      const { api } = setup({
        responses: [{ status, body: { error: 'Server says no' } }],
      });

      const error = await rejection(api.request('POST', '/events'));

      expect(error.kind).toBe(kind);
      expect(error.status).toBe(status);
      expect(error.message).toBe('Server says no');
    });

    test('reads Retry-After from a rate limited response', async () => {
      const { api } = setup({
        responses: [
          {
            status: 429,
            body: { error: 'Too many requests' },
            headers: { 'Retry-After': '1800' },
          },
        ],
      });

      const error = await rejection(api.requestAccessLink('ania@example.com'));

      expect(error.kind).toBe('rateLimited');
      expect(error.retryAfterSeconds).toBe(1800);
    });

    test('maps an error without a JSON body', async () => {
      const { api } = setup({ responses: [{ status: 502 }] });

      const error = await rejection(api.getMe());

      expect(error.kind).toBe('server');
      expect(error.retryAfterSeconds).toBeNull();
    });

    test('maps an unreachable server to a network error', async () => {
      const api = createApiClient({
        getToken: () => null,
        onUnauthorized: vi.fn(),
        fetch: vi
          .fn<typeof fetch>()
          .mockRejectedValue(new TypeError('offline')),
      });

      const error = await rejection(api.getMe());

      expect(error.kind).toBe('network');
      expect(error.status).toBe(0);
    });
  });
});
