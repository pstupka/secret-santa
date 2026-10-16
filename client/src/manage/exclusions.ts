import type { Exclusion, ParticipantSummary } from '@/api';

// The server stores each pair once with the smaller id first.
export const normalisedPair = (
  firstId: string,
  secondId: string,
): [string, string] =>
  firstId < secondId ? [firstId, secondId] : [secondId, firstId];

export const exclusionKey = ({
  participantAId,
  participantBId,
}: Pick<Exclusion, 'participantAId' | 'participantBId'>) =>
  `${participantAId}:${participantBId}`;

// Whether the two participants, in either order, are already excluded.
export const isExcluded = (
  exclusions: Exclusion[],
  firstId: string,
  secondId: string,
): boolean => {
  const [participantAId, participantBId] = normalisedPair(firstId, secondId);
  const key = exclusionKey({ participantAId, participantBId });
  return exclusions.some((exclusion) => exclusionKey(exclusion) === key);
};

// An exclusion with both participants' names, for the list.
export interface NamedExclusion extends Exclusion {
  key: string;
  nameA: string;
  nameB: string;
}

export const namedExclusions = (
  exclusions: Exclusion[],
  participants: ParticipantSummary[],
): NamedExclusion[] => {
  const names = new Map(
    participants.map(({ id, displayName }) => [id, displayName]),
  );
  return exclusions.map((exclusion) => ({
    ...exclusion,
    key: exclusionKey(exclusion),
    nameA: names.get(exclusion.participantAId) ?? '?',
    nameB: names.get(exclusion.participantBId) ?? '?',
  }));
};
