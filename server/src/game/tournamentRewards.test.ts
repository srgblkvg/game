/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTournamentRewards } from './tournamentRewards';

test('три участника получают места и фонд 50/30/20', () => {
  const rewards = calculateTournamentRewards({
    prizePool: 1000,
    participantIds: [1, 2, 3],
    matches: [
      { round: 1, player1Id: 1, player2Id: null, winnerId: 1 },
      { round: 1, player1Id: 2, player2Id: 3, winnerId: 2 },
      { round: 2, player1Id: 1, player2Id: 2, winnerId: 1 },
    ],
  });
  assert.deepEqual(rewards, [
    { userId: 1, place: 1, prize: 500 },
    { userId: 2, place: 2, prize: 300 },
    { userId: 3, place: 3, prize: 200 },
  ]);
});

test('два участника получают фонд 70/30', () => {
  const rewards = calculateTournamentRewards({
    prizePool: 101,
    participantIds: [1, 2],
    matches: [{ round: 1, player1Id: 1, player2Id: 2, winnerId: 2 }],
  });
  assert.deepEqual(rewards, [
    { userId: 2, place: 1, prize: 70 },
    { userId: 1, place: 2, prize: 31 },
  ]);
});
