import { describe, expect, test, vi } from 'vitest';

import { magicTokenFromHash, removeHashFromUrl } from './personalLink';

describe('personal link', () => {
  test.each([
    ['#token=abc123', 'abc123'],
    ['token=abc123', 'abc123'],
    ['#token=a-b_c.d&utm=x', 'a-b_c.d'],
  ])('reads the magic token from %s', (hash, token) => {
    expect(magicTokenFromHash(hash)).toBe(token);
  });

  test.each(['', '#', '#token=', '#token=%20', '#other=1'])(
    'finds no magic token in "%s"',
    (hash) => {
      expect(magicTokenFromHash(hash)).toBeNull();
    },
  );

  test('removes the fragment, keeping the path, query and history state', () => {
    const history = { state: { back: '/' }, replaceState: vi.fn() };

    removeHashFromUrl({ pathname: '/auth', search: '?from=mail' }, history);

    expect(history.replaceState).toHaveBeenCalledWith(
      { back: '/' },
      '',
      '/auth?from=mail',
    );
  });
});
