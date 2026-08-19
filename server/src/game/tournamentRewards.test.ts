/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTournamentRewards, getThirdPlacePair } from './tournamentRewards';

test('пара за третье место состоит из проигравших двух полуфиналов', () => {
  assert.deepEqual(getThirdPlacePair([
    { round: 2, stage: 'playoff', player1Id: 1, player2Id: 4, winnerId: 1 },
    { round: 2, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
  ]), [4, 3]);
});

test('матч за третье место не создаётся без двух сыгранных полуфиналов', () => {
  assert.equal(getThirdPlacePair([
    { round: 1, stage: 'playoff', player1Id: 1, player2Id: null, winnerId: 1 },
    { round: 1, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
  ]), null);
});

test('бронзу получает только победитель завершённого матча за третье место', () => {
  const matches = [
    { round: 1, stage: 'playoff', player1Id: 1, player2Id: 4, winnerId: 1 },
    { round: 1, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
    { round: 2, stage: 'playoff', player1Id: 1, player2Id: 2, winnerId: 1 },
    { round: 2, stage: 'third_place', player1Id: 4, player2Id: 3, winnerId: 3 },
  ];
  const rewards = calculateTournamentRewards({
    prizePool: 1000,
    participantIds: [1, 2, 3, 4],
    matches,
  });

  assert.deepEqual(rewards, [
    { userId: 1, place: 1, prize: 500 },
    { userId: 2, place: 2, prize: 300 },
    { userId: 3, place: 3, prize: 200 },
  ]);
});

test('без завершённого матча за третье место награды не выплачиваются частично', () => {
  const matches = [
    { round: 1, stage: 'playoff', player1Id: 1, player2Id: 4, winnerId: 1 },
    { round: 1, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
    { round: 2, stage: 'playoff', player1Id: 1, player2Id: 2, winnerId: 1 },
    { round: 2, stage: 'third_place', player1Id: 4, player2Id: 3, winnerId: null },
  ];
  const rewards = calculateTournamentRewards({
    prizePool: 1000,
    participantIds: [1, 2, 3, 4],
    matches,
  });

  assert.deepEqual(rewards, []);
});

test('для четырёх участников без матча за третье место награды fail-closed', () => {
  const rewards = calculateTournamentRewards({
    prizePool: 1000,
    participantIds: [1, 2, 3, 4],
    matches: [
      { round: 1, stage: 'playoff', player1Id: 1, player2Id: 4, winnerId: 1 },
      { round: 1, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
      { round: 2, stage: 'playoff', player1Id: 1, player2Id: 2, winnerId: 1 },
    ],
  });

  assert.deepEqual(rewards, []);
});

test('финал определяется только среди матчей stage playoff', () => {
  const matches = [
    { round: 1, stage: 'playoff', player1Id: 1, player2Id: 4, winnerId: 1 },
    { round: 1, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
    { round: 2, stage: 'playoff', player1Id: 1, player2Id: 2, winnerId: 1 },
    { round: 99, stage: 'third_place', player1Id: 4, player2Id: 3, winnerId: 3 },
  ];
  const rewards = calculateTournamentRewards({
    prizePool: 1000,
    participantIds: [1, 2, 3, 4],
    matches,
  });

  assert.deepEqual(rewards, [
    { userId: 1, place: 1, prize: 500 },
    { userId: 2, place: 2, prize: 300 },
    { userId: 3, place: 3, prize: 200 },
  ]);
});

test('два участника получают фонд 70/30', () => {
  const matches = [
    { round: 1, stage: 'playoff', player1Id: 1, player2Id: 2, winnerId: 2 },
  ];
  const rewards = calculateTournamentRewards({
    prizePool: 101,
    participantIds: [1, 2],
    matches,
  });

  assert.deepEqual(rewards, [
    { userId: 2, place: 1, prize: 70 },
    { userId: 1, place: 2, prize: 31 },
  ]);
});

test('при трёх участниках единственный не финалист получает бронзу автоматически', () => {
  const rewards = calculateTournamentRewards({
    prizePool: 1000,
    participantIds: [1, 2, 3],
    matches: [
      { round: 1, stage: 'playoff', player1Id: 1, player2Id: null, winnerId: 1 },
      { round: 1, stage: 'playoff', player1Id: 2, player2Id: 3, winnerId: 2 },
      { round: 2, stage: 'playoff', player1Id: 1, player2Id: 2, winnerId: 1 },
    ],
  });
  assert.deepEqual(rewards, [
    { userId: 1, place: 1, prize: 500 },
    { userId: 2, place: 2, prize: 300 },
    { userId: 3, place: 3, prize: 200 },
  ]);
});

test('матчи без stage поддерживаются как legacy playoff', () => {
  const rewards = calculateTournamentRewards({
    prizePool: 101,
    participantIds: [1, 2],
    matches: [{ round: 1, player1Id: 1, player2Id: 2, winnerId: 1 }],
  });

  assert.deepEqual(rewards, [
    { userId: 1, place: 1, prize: 70 },
    { userId: 2, place: 2, prize: 31 },
  ]);
});
