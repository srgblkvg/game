export interface TournamentRewardMatch {
  round: number;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
}

export interface TournamentReward {
  userId: number;
  place: 1 | 2 | 3;
  prize: number;
}

export function calculateTournamentRewards(input: {
  prizePool: number;
  participantIds: number[];
  matches: TournamentRewardMatch[];
}): TournamentReward[] {
  const completed = input.matches.filter(match => match.winnerId);
  if (completed.length === 0) return [];
  const finalRound = Math.max(...completed.map(match => match.round));
  const final = completed.find(match => match.round === finalRound && match.player1Id && match.player2Id);
  if (!final?.winnerId) return [];
  const winnerId = final.winnerId;
  const secondId = final.player1Id === winnerId ? final.player2Id : final.player1Id;
  const participants = [...new Set(input.participantIds)];
  const pool = Math.max(0, Math.floor(input.prizePool));
  if (!secondId) return [{ userId: winnerId, place: 1, prize: pool }];
  if (participants.length < 3) {
    const first = Math.floor(pool * 0.7);
    return [
      { userId: winnerId, place: 1, prize: first },
      { userId: secondId, place: 2, prize: pool - first },
    ];
  }
  const excluded = new Set([winnerId, secondId]);
  const thirdId = participants
    .filter(userId => !excluded.has(userId))
    .map(userId => ({
      userId,
      lostRound: Math.max(0, ...completed
        .filter(match => (match.player1Id === userId || match.player2Id === userId) && match.winnerId !== userId)
        .map(match => match.round)),
    }))
    .sort((a, b) => b.lostRound - a.lostRound || a.userId - b.userId)[0]?.userId;
  const first = Math.floor(pool * 0.5);
  const second = Math.floor(pool * 0.3);
  const rewards: TournamentReward[] = [
    { userId: winnerId, place: 1, prize: first },
    { userId: secondId, place: 2, prize: second },
  ];
  if (thirdId) rewards.push({ userId: thirdId, place: 3, prize: pool - first - second });
  return rewards;
}
