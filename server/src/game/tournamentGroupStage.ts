export type RandomSource = () => number;

export interface TournamentGroup {
  name: string;
  userIds: number[];
}

export interface GroupMatchResult {
  player1Id: number;
  player2Id: number;
  winnerId: number;
}

export interface RankedGroupPlayer {
  userId: number;
  wins: number;
}

export interface GroupQualificationState {
  qualifiedIds: number[];
  tiedIds: number[];
  slots: number;
}

export interface GroupQualifier {
  groupName: string;
  firstId: number;
  secondId: number;
}

function nextPowerOfTwo(value: number): number {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

export function shuffleWith<T>(values: readonly T[], rng: RandomSource): T[] {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function drawTournamentGroups(userIds: number[], rng: RandomSource = Math.random): TournamentGroup[] {
  if (userIds.length <= 8) return [];
  const groupCount = nextPowerOfTwo(Math.ceil(userIds.length / 4));
  const groups = Array.from({ length: groupCount }, (_, index) => ({
    name: String.fromCharCode(65 + index),
    userIds: [] as number[],
  }));
  shuffleWith(userIds, rng).forEach((userId, index) => {
    groups[index % groupCount]!.userIds.push(userId);
  });
  return groups;
}

export function createRoundRobinMatches(groupName: string, userIds: number[]) {
  const matches: Array<{ groupName: string; player1Id: number; player2Id: number }> = [];
  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      matches.push({ groupName, player1Id: userIds[i]!, player2Id: userIds[j]! });
    }
  }
  return matches;
}

export function rankGroup(
  userIds: number[],
  matches: GroupMatchResult[],
  rng: RandomSource = Math.random,
): RankedGroupPlayer[] {
  const wins = new Map(userIds.map(userId => [userId, 0]));
  for (const match of matches) wins.set(match.winnerId, (wins.get(match.winnerId) || 0) + 1);
  const drawOrder = new Map(shuffleWith(userIds, rng).map((userId, index) => [userId, index]));
  return userIds.map(userId => ({ userId, wins: wins.get(userId) || 0 })).sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    const direct = matches.find(match =>
      (match.player1Id === a.userId && match.player2Id === b.userId)
      || (match.player1Id === b.userId && match.player2Id === a.userId));
    if (direct) return direct.winnerId === a.userId ? -1 : 1;
    return (drawOrder.get(a.userId) || 0) - (drawOrder.get(b.userId) || 0);
  });
}

export function createFixedPlayoffPairs(qualifiers: GroupQualifier[]): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let index = 0; index < qualifiers.length; index += 2) {
    const left = qualifiers[index];
    const right = qualifiers[index + 1];
    if (!left || !right) throw new Error('Для фиксированной сетки группы должны образовывать пары');
    pairs.push([left.firstId, right.secondId], [right.firstId, left.secondId]);
  }
  return pairs;
}

export function getGroupQualificationState(
  userIds: number[],
  matches: GroupMatchResult[],
): GroupQualificationState {
  const wins = new Map(userIds.map(userId => [userId, 0]));
  for (const match of matches) wins.set(match.winnerId, (wins.get(match.winnerId) || 0) + 1);
  const scores = [...new Set(userIds.map(userId => wins.get(userId) || 0))].sort((a, b) => b - a);
  const qualifiedIds: number[] = [];
  for (const score of scores) {
    const tier = userIds.filter(userId => (wins.get(userId) || 0) === score).sort((a, b) => a - b);
    const slots = 2 - qualifiedIds.length;
    if (slots <= 0) break;
    if (tier.length <= slots) qualifiedIds.push(...tier);
    else return { qualifiedIds, tiedIds: tier, slots };
  }
  return { qualifiedIds, tiedIds: [], slots: 0 };
}
