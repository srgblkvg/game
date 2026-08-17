/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { runTournamentGroupStage } from './tournamentGroupRunner';

function deterministicFight(player1Id: number, player2Id: number): number {
  return Math.min(player1Id, player2Id);
}

test('16 участников проходят групповой этап и дают восемь фиксированных участников плей-офф', async () => {
  const stored: Array<{ stage: string; groupName: string; player1Id: number; player2Id: number }> = [];
  const result = await runTournamentGroupStage({
    userIds: Array.from({ length: 16 }, (_, index) => index + 1),
    rng: () => 0.999,
    fight: async (player1Id, player2Id, metadata) => {
      stored.push({ ...metadata, player1Id, player2Id });
      return deterministicFight(player1Id, player2Id);
    },
  });
  assert.equal(result.playoffPairs.length, 4);
  assert.equal(new Set(result.playoffPairs.flat()).size, 8);
  assert.equal(stored.filter(match => match.stage === 'group').length, 24);
  assert.equal(stored.filter(match => match.stage === 'tiebreak').length, 0);
});

test('равенство на проходном месте запускает серию до трёх побед', async () => {
  let alternating = false;
  const tiebreakWins = new Map<number, number>();
  const stored: Array<{ stage: string; seriesIndex: number }> = [];
  const result = await runTournamentGroupStage({
    userIds: Array.from({ length: 9 }, (_, index) => index + 1),
    rng: () => 0.999,
    fight: async (player1Id, player2Id, metadata) => {
      stored.push({ stage: metadata.stage, seriesIndex: metadata.seriesIndex });
      if (metadata.stage === 'group') {
        alternating = !alternating;
        return alternating ? player1Id : player2Id;
      }
      const wins = tiebreakWins.get(player1Id) || 0;
      if (wins < 3) {
        tiebreakWins.set(player1Id, wins + 1);
        return player1Id;
      }
      return player2Id;
    },
  });
  assert.ok(stored.some(match => match.stage === 'tiebreak'));
  const series = stored.filter(match => match.stage === 'tiebreak').map(match => match.seriesIndex);
  assert.ok(Math.max(...series) >= 3);
  assert.equal(new Set(result.playoffPairs.flat()).size, 8);
});

test('групповой этап отклоняет восемь или меньше участников', async () => {
  await assert.rejects(() => runTournamentGroupStage({
    userIds: [1,2,3,4,5,6,7,8],
    fight: async (a) => a,
  }), /больше восьми/);
});
