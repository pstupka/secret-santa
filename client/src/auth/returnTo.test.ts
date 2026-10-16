import { afterEach, describe, expect, test } from 'vitest';

import {
  rememberReturnTo,
  RETURN_TO_MAX_AGE_MS,
  takeReturnTo,
} from './returnTo';

const NOW = Date.parse('2026-12-01T10:00:00Z');

describe('return-to path', () => {
  afterEach(() => localStorage.clear());

  test('returns the remembered path once', () => {
    rememberReturnTo('/events/e1/assignment?x=1', NOW);

    expect(takeReturnTo(NOW + 1000)).toBe('/events/e1/assignment?x=1');
    expect(takeReturnTo(NOW + 2000)).toBeNull();
  });

  test('is empty when nothing was remembered', () => {
    expect(takeReturnTo(NOW)).toBeNull();
  });

  test('forgets a stale path', () => {
    rememberReturnTo('/events/e1/assignment', NOW);

    expect(takeReturnTo(NOW + RETURN_TO_MAX_AGE_MS + 1)).toBeNull();
  });

  test.each(['//evil.example.com/x', 'https://evil.example.com', '/auth'])(
    'ignores unsafe path %s',
    (path) => {
      rememberReturnTo(path, NOW);

      expect(takeReturnTo(NOW)).toBeNull();
    },
  );

  test('ignores a tampered stored value', () => {
    localStorage.setItem(
      'secret-santa.returnTo',
      JSON.stringify({ path: '//evil.example.com', savedAt: NOW }),
    );
    expect(takeReturnTo(NOW)).toBeNull();

    localStorage.setItem('secret-santa.returnTo', 'not json');
    expect(takeReturnTo(NOW)).toBeNull();
  });
});
