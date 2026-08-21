export interface TournamentRewardMatch {
  round: number;
  stage?: string;
  player1Id: number | null;
  player2Id: number | null;
  winnerId: number | null;
}

export interface TournamentReward {
  userId: number;
  place: 1 | 2 | 3;
  prize: number;
}

export function getThirdPlacePair(matches: TournamentRewardMatch[]): [number, number] | null {
  const completedPlayoff = matches.filter(match =>
    (!match.stage || match.stage === 'playoff')
    && match.winnerId
    && match.player1Id
    && match.player2Id,
  );
  if (completedPlayoff.length < 2) return null;
  const rounds = [...new Set(completedPlayoff.map(match => match.round))].sort((a, b) => b - a);
  const semifinals = rounds
    .map(round => completedPlayoff.filter(match => match.round === round))
    .find(matchesInRound => matchesInRound.length === 2);
  if (!semifinals) return null;
  const losers = semifinals.map(match => match.player1Id === match.winnerId ? match.player2Id : match.player1Id);
  return losers[0] && losers[1] ? [losers[0], losers[1]] : null;
}

export function calculateTournamentRewards(input: {
  prizePool: number;
  participantIds: number[];
  matches: TournamentRewardMatch[];
}): TournamentReward[] {
  const completed = input.matches.filter(match => match.winnerId);
  const playoff = completed.filter(match => !match.stage || match.stage === 'playoff');
  if (playoff.length === 0) return [];
  const finalRound = Math.max(...playoff.map(match => match.round));
  const final = playoff.find(match => match.round === finalRound && match.player1Id && match.player2Id);
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
  const thirdPlaceMatch = completed.find(match => match.stage === 'third_place' && match.player1Id && match.player2Id);
  let thirdId = thirdPlaceMatch?.winnerId || null;
  if (!thirdId && participants.length === 3) {
    const finalists = new Set([winnerId, secondId]);
    thirdId = participants.find(userId => !finalists.has(userId)) || null;
  }
  // Для сетки из четырёх и более игроков фонд 50/30/20 можно
  // распределять только после завершения отдельного бронзового матча.
  // Иначе fail-closed: не выплачиваем частичные 80% и не завершаем турнир.
  if (!thirdId) return [];
  const first = Math.floor(pool * 0.5);
  const second = Math.floor(pool * 0.3);
  return [
    { userId: winnerId, place: 1, prize: first },
    { userId: secondId, place: 2, prize: second },
    { userId: thirdId, place: 3, prize: pool - first - second },
  ];
}
