import { randomInt } from 'node:crypto';

// The draw as a pure function (GLOSSARY: Draw, Assignment, Exclusion).
//
// Every participant gives to exactly one other participant and receives from
// exactly one: the assignments form a single bijection with no self-pairs
// and no pair that an exclusion forbids, in either direction.
//
// Randomised backtracking with a feasibility check: givers are taken in
// random order and each tries its allowed recipients in random order,
// keeping the first one after which the remaining givers can still all be
// matched (a perfect bipartite matching exists). The check makes impossible
// draws detectable up front and means the search never runs into a dead end,
// so it always terminates quickly, however tight the exclusions are.

// A uniform random integer in [0, maxExclusive). Injectable for tests.
export type RandomInt = (maxExclusive: number) => number;

export const cryptoRandomInt: RandomInt = (maxExclusive) =>
  randomInt(maxExclusive);

export type ExclusionPair = readonly [string, string];

export type DrawResult =
  // giver id → recipient id, one entry per participant.
  { possible: true; assignments: Map<string, string> } | { possible: false };

const shuffled = <T>(values: readonly T[], random: RandomInt): T[] => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Whether every giver in `givers` can get a distinct recipient from
// `available` among their `allowed` ones (Kuhn's augmenting paths).
const hasPerfectMatching = (
  givers: readonly number[],
  available: ReadonlySet<number>,
  allowed: readonly (readonly number[])[],
): boolean => {
  const giverOf = new Map<number, number>();
  const augment = (giver: number, visited: Set<number>): boolean =>
    allowed[giver].some((recipient) => {
      if (!available.has(recipient) || visited.has(recipient)) return false;
      visited.add(recipient);
      const current = giverOf.get(recipient);
      if (current === undefined || augment(current, visited)) {
        giverOf.set(recipient, giver);
        return true;
      }
      return false;
    });
  return givers.every((giver) => augment(giver, new Set()));
};

// Draws assignments for `participantIds` (distinct) respecting `exclusions`
// (symmetric pairs; pairs naming anyone else are ignored). Impossible when
// there are fewer than two participants or the exclusions leave no valid
// bijection.
export const draw = (
  participantIds: readonly string[],
  exclusions: readonly ExclusionPair[],
  random: RandomInt = cryptoRandomInt,
): DrawResult => {
  const n = participantIds.length;
  if (n < 2) return { possible: false };

  const indexOf = new Map(participantIds.map((id, index) => [id, index]));
  const excluded = new Set<string>();
  exclusions.forEach(([a, b]) => {
    const ai = indexOf.get(a);
    const bi = indexOf.get(b);
    if (ai === undefined || bi === undefined) return;
    excluded.add(`${ai}:${bi}`);
    excluded.add(`${bi}:${ai}`);
  });
  const everyone = participantIds.map((_, index) => index);
  const allowed = everyone.map((giver) =>
    everyone.filter(
      (recipient) =>
        recipient !== giver && !excluded.has(`${giver}:${recipient}`),
    ),
  );

  const available = new Set(everyone);
  if (!hasPerfectMatching(everyone, available, allowed)) {
    return { possible: false };
  }

  const recipientOf: number[] = new Array(n);
  const givers = shuffled(everyone, random);
  givers.forEach((giver, position) => {
    const remainingGivers = givers.slice(position + 1);
    const recipient = shuffled(allowed[giver], random).find((candidate) => {
      if (!available.has(candidate)) return false;
      available.delete(candidate);
      if (hasPerfectMatching(remainingGivers, available, allowed)) return true;
      available.add(candidate);
      return false;
    });
    // A perfect matching existed before this giver, so one of its recipients
    // keeps the rest matchable.
    if (recipient === undefined) throw new Error('Draw invariant violated');
    recipientOf[giver] = recipient;
  });

  return {
    possible: true,
    assignments: new Map(
      everyone.map((giver) => [
        participantIds[giver],
        participantIds[recipientOf[giver]],
      ]),
    ),
  };
};
