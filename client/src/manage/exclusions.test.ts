import { describe, expect, test } from 'vitest';

import type { Exclusion } from '@/api';
import { ania, babcia, jan } from '@/test/organizerParticipants';
import { isExcluded, namedExclusions, normalisedPair } from './exclusions';

const exclusions: Exclusion[] = [
  { participantAId: 'ania', participantBId: 'babcia', builtIn: true },
  { participantAId: 'ania', participantBId: 'jan', builtIn: false },
];

test('normalises a pair with the smaller id first', () => {
  expect(normalisedPair('jan', 'ania')).toEqual(['ania', 'jan']);
  expect(normalisedPair('ania', 'jan')).toEqual(['ania', 'jan']);
});

describe('isExcluded', () => {
  test('finds a pair in either order', () => {
    expect(isExcluded(exclusions, 'jan', 'ania')).toBe(true);
    expect(isExcluded(exclusions, 'ania', 'jan')).toBe(true);
  });

  test('finds built-in pairs', () => {
    expect(isExcluded(exclusions, 'babcia', 'ania')).toBe(true);
  });

  test('a pair that is not excluded', () => {
    expect(isExcluded(exclusions, 'jan', 'babcia')).toBe(false);
  });
});

test('names both participants of each exclusion', () => {
  expect(namedExclusions(exclusions, [jan, ania, babcia])).toEqual([
    {
      ...exclusions[0],
      key: 'ania:babcia',
      nameA: 'Ania',
      nameB: 'Babcia Zosia',
    },
    { ...exclusions[1], key: 'ania:jan', nameA: 'Ania', nameB: 'Jan' },
  ]);
});
