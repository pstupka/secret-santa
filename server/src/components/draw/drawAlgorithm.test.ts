import { describe, test, expect } from 'vitest';

import { draw, ExclusionPair, RandomInt } from './drawAlgorithm';

// Property-style tests: many random inputs from seeded generators, so a
// failure is reproducible from its seed.

// Park–Miller: a small seeded PRNG (exact in double precision).
const MODULUS = 2147483647;
const seededRandom = (seed: number): RandomInt => {
  let state = seed % MODULUS || 1;
  const next = () => {
    state = (state * 48271) % MODULUS;
    return state;
  };
  // Small seeds start with small states; skip the first few.
  for (let i = 0; i < 10; i += 1) next();
  return (maxExclusive) => Math.floor((next() / MODULUS) * maxExclusive);
};

const participants = (count: number) =>
  Array.from({ length: count }, (_, index) => `p${index}`);

// Each unordered pair excluded with probability `density`.
const randomExclusions = (
  ids: string[],
  density: number,
  random: RandomInt,
): ExclusionPair[] =>
  ids.flatMap((a, i) =>
    ids
      .slice(i + 1)
      .filter(() => random(1000) < density * 1000)
      .map((b): ExclusionPair => [a, b]),
  );

const isExcluded = (exclusions: ExclusionPair[], a: string, b: string) =>
  exclusions.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// Brute force: whether any valid bijection exists (small n only).
const anyValidDraw = (ids: string[], exclusions: ExclusionPair[]): boolean => {
  const search = (giver: number, used: Set<string>): boolean =>
    giver === ids.length ||
    ids.some(
      (recipient) =>
        recipient !== ids[giver] &&
        !used.has(recipient) &&
        !isExcluded(exclusions, ids[giver], recipient) &&
        search(giver + 1, new Set([...used, recipient])),
    );
  return ids.length >= 2 && search(0, new Set());
};

const expectValidDraw = (
  ids: string[],
  exclusions: ExclusionPair[],
  assignments: Map<string, string>,
) => {
  // A bijection over exactly the participants.
  expect([...assignments.keys()].sort()).toEqual([...ids].sort());
  expect([...assignments.values()].sort()).toEqual([...ids].sort());
  assignments.forEach((recipient, giver) => {
    expect(recipient).not.toBe(giver);
    expect(isExcluded(exclusions, giver, recipient)).toBe(false);
  });
};

describe('draw', () => {
  test('without exclusions: always a bijection with no self-pairs', () => {
    for (let seed = 1; seed <= 300; seed += 1) {
      const random = seededRandom(seed);
      const ids = participants(2 + random(30));

      const result = draw(ids, [], random);

      expect(result.possible).toBe(true);
      if (result.possible) expectValidDraw(ids, [], result.assignments);
    }
  });

  test('with random exclusions: valid whenever a draw exists, impossible otherwise', () => {
    let possibleCount = 0;
    let impossibleCount = 0;
    for (let seed = 1; seed <= 1000; seed += 1) {
      const random = seededRandom(seed);
      const ids = participants(2 + random(6));
      const exclusions = randomExclusions(ids, random(80) / 100, random);

      const result = draw(ids, exclusions, random);

      expect(result.possible, `seed ${seed}`).toBe(
        anyValidDraw(ids, exclusions),
      );
      if (result.possible) {
        possibleCount += 1;
        expectValidDraw(ids, exclusions, result.assignments);
      } else {
        impossibleCount += 1;
      }
    }
    // Both kinds of input were actually exercised.
    expect(possibleCount).toBeGreaterThan(100);
    expect(impossibleCount).toBeGreaterThan(100);
  });

  test('large events with many exclusions stay valid', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const random = seededRandom(seed);
      const ids = participants(30 + random(21));
      const exclusions = randomExclusions(ids, 0.5, random);

      const result = draw(ids, exclusions, random);

      expect(result.possible).toBe(true);
      if (result.possible) expectValidDraw(ids, exclusions, result.assignments);
    }
  });

  test('respects caretaker ↔ managed participant pairs like any exclusion', () => {
    // Ania is Zosia's caretaker, Tomek is Janek's.
    const ids = ['ania', 'zosia', 'tomek', 'janek'];
    const exclusions: ExclusionPair[] = [
      ['ania', 'zosia'],
      ['tomek', 'janek'],
    ];
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = draw(ids, exclusions, seededRandom(seed));
      expect(result.possible).toBe(true);
      if (result.possible) expectValidDraw(ids, exclusions, result.assignments);
    }
  });

  test('detects three participants all excluded from each other', () => {
    const ids = participants(3);
    const exclusions: ExclusionPair[] = [
      ['p0', 'p1'],
      ['p0', 'p2'],
      ['p1', 'p2'],
    ];

    expect(draw(ids, exclusions, seededRandom(1))).toEqual({
      possible: false,
    });
  });

  test('detects a participant excluded from everyone else', () => {
    const ids = participants(10);
    const exclusions = ids
      .slice(1)
      .map((other): ExclusionPair => ['p0', other]);

    expect(draw(ids, exclusions, seededRandom(1))).toEqual({
      possible: false,
    });
  });

  test('detects a Hall violation: three people who may only give to the same two', () => {
    // p2, p3, p4 are excluded from everyone but p0 and p1.
    const ids = participants(5);
    const exclusions: ExclusionPair[] = [
      ['p2', 'p3'],
      ['p2', 'p4'],
      ['p3', 'p4'],
    ];

    expect(draw(ids, exclusions, seededRandom(1))).toEqual({
      possible: false,
    });
  });

  test('is impossible with fewer than two participants', () => {
    expect(draw([], [])).toEqual({ possible: false });
    expect(draw(['p0'], [])).toEqual({ possible: false });
  });

  test('ignores exclusions naming someone outside the draw', () => {
    const ids = participants(3);
    const result = draw(ids, [['p0', 'declined']], seededRandom(1));

    expect(result.possible).toBe(true);
  });

  test('is random: different seeds give different draws', () => {
    const ids = participants(3);
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 50; seed += 1) {
      const result = draw(ids, [], seededRandom(seed));
      if (result.possible) {
        outcomes.add(ids.map((id) => result.assignments.get(id)).join(','));
      }
    }
    // Both derangements of three participants occur.
    expect(outcomes).toEqual(new Set(['p1,p2,p0', 'p2,p0,p1']));
  });

  test('uses crypto randomness by default', () => {
    const ids = participants(5);
    const result = draw(ids, []);

    expect(result.possible).toBe(true);
    if (result.possible) expectValidDraw(ids, [], result.assignments);
  });
});
