import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { connectApi, isApiError } from '@/api';
import { fakeFetch, requestHeaders } from '@/test/fakeFetch';
import { MAGIC_TOKEN_STORAGE_KEY, useAuthStore } from './auth';

const ania = { id: 'person-1', email: 'ania@example.com' };

// A fresh store wired to the api client like in the app.
const setupAuth = () => {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  const navigator = { replace: vi.fn() };
  connectApi(auth, navigator);
  return { auth, navigator };
};

describe('auth store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('starts signed out without a stored magic token', () => {
    const { auth } = setupAuth();

    expect(auth.token).toBeNull();
    expect(auth.isSignedIn).toBe(false);
    expect(auth.me).toBeNull();
  });

  test('restores the magic token from localStorage', () => {
    localStorage.setItem(MAGIC_TOKEN_STORAGE_KEY, 'stored-token');

    const { auth } = setupAuth();

    expect(auth.token).toBe('stored-token');
    expect(auth.isSignedIn).toBe(true);
  });

  test('signs in with a personal link: stores the magic token and loads the person', async () => {
    const fetch = fakeFetch({ body: ania });
    vi.stubGlobal('fetch', fetch);
    const { auth } = setupAuth();

    await expect(auth.signIn('magic-token')).resolves.toEqual(ania);

    expect(auth.token).toBe('magic-token');
    expect(auth.me).toEqual(ania);
    expect(localStorage.getItem(MAGIC_TOKEN_STORAGE_KEY)).toBe('magic-token');
    expect(fetch).toHaveBeenCalledWith('/api/me', expect.anything());
    expect(requestHeaders(fetch).Authorization).toBe('Bearer magic-token');
  });

  test('signing in with a new personal link replaces the stored magic token', async () => {
    localStorage.setItem(MAGIC_TOKEN_STORAGE_KEY, 'old-token');
    const fetch = fakeFetch({ body: ania });
    vi.stubGlobal('fetch', fetch);
    const { auth } = setupAuth();

    await auth.signIn('new-token');

    expect(localStorage.getItem(MAGIC_TOKEN_STORAGE_KEY)).toBe('new-token');
    expect(requestHeaders(fetch).Authorization).toBe('Bearer new-token');
  });

  test('an invalid personal link signs out and sends the person to the landing page', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ status: 401, body: { error: 'Unauthorized' } }),
    );
    const { auth, navigator } = setupAuth();

    const error = await auth.signIn('expired-token').catch((e: unknown) => e);

    expect(isApiError(error) && error.kind).toBe('unauthorized');
    expect(auth.token).toBeNull();
    expect(auth.me).toBeNull();
    expect(localStorage.getItem(MAGIC_TOKEN_STORAGE_KEY)).toBeNull();
    expect(navigator.replace).toHaveBeenCalledWith('/?signedOut=1');
  });

  test('keeps the magic token when /me fails for another reason', async () => {
    localStorage.setItem(MAGIC_TOKEN_STORAGE_KEY, 'stored-token');
    vi.stubGlobal('fetch', fakeFetch({ status: 503 }));
    const { auth, navigator } = setupAuth();

    await expect(auth.loadMe()).rejects.toMatchObject({ kind: 'server' });

    expect(auth.token).toBe('stored-token');
    expect(navigator.replace).not.toHaveBeenCalled();
  });

  test('signs out: forgets the magic token and the person', async () => {
    vi.stubGlobal('fetch', fakeFetch({ body: ania }));
    const { auth } = setupAuth();
    await auth.signIn('magic-token');

    auth.signOut();

    expect(auth.token).toBeNull();
    expect(auth.me).toBeNull();
    expect(auth.isSignedIn).toBe(false);
    expect(localStorage.getItem(MAGIC_TOKEN_STORAGE_KEY)).toBeNull();
  });

  describe('when localStorage is unavailable', () => {
    beforeEach(() => {
      const unavailable = () => {
        throw new DOMException('Storage is disabled', 'SecurityError');
      };
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(unavailable);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(unavailable);
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(unavailable);
    });

    test('starts signed out', () => {
      const { auth } = setupAuth();

      expect(auth.isSignedIn).toBe(false);
    });

    test('still signs in and out for the current page', async () => {
      vi.stubGlobal('fetch', fakeFetch({ body: ania }));
      const { auth } = setupAuth();

      await auth.signIn('magic-token');
      expect(auth.token).toBe('magic-token');
      expect(auth.me).toEqual(ania);

      auth.signOut();
      expect(auth.isSignedIn).toBe(false);
    });
  });
});
