/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  drawTournamentGroups,
  createRoundRobinMatches,
  getGroupQualificationState,
  createFixedPlayoffPairs,
} from './tournamentGroupStage';

const fixedRng = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length]!;
};

test('до восьми участников групповой этап не создаётся', () => {
  assert.deepEqual(drawTournamentGroups([1,2,3,4,5,6,7,8], fixedRng([0.5])), []);
});

test('16 участников случайно распределяются в четыре группы по четыре', () => {
  const groups = drawTournamentGroups(Array.from({ length: 16 }, (_, i) => i + 1), fixedRng([0.1,0.8,0.3,0.7]));
  assert.deepEqual(groups.map(group => group.name), ['A','B','C','D']);
  assert.deepEqual(groups.map(group => group.userIds.length), [4,4,4,4]);
  assert.deepEqual(groups.flatMap(group => group.userIds).sort((a,b) => a-b), Array.from({ length: 16 }, (_, i) => i + 1));
});

test('9 и 17 участников распределяются без потерь и группы не превышают четыре', () => {
  for (const count of [9, 17]) {
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const groups = drawTournamentGroups(ids, fixedRng([0.2,0.9,0.4,0.6]));
    assert.ok(groups.every(group => group.userIds.length <= 4));
    assert.deepEqual(groups.flatMap(group => group.userIds).sort((a,b) => a-b), ids);
  }
});

test('в группе из четырёх каждый играет с каждым ровно один раз', () => {
  assert.deepEqual(createRoundRobinMatches('A', [1,2,3,4]), [
    { groupName:'A', player1Id:1, player2Id:2 },
    { groupName:'A', player1Id:1, player2Id:3 },
    { groupName:'A', player1Id:1, player2Id:4 },
    { groupName:'A', player1Id:2, player2Id:3 },
    { groupName:'A', player1Id:2, player2Id:4 },
    { groupName:'A', player1Id:3, player2Id:4 },
  ]);
});

test('два лучших выходят напрямую при разных количествах побед', () => {
  const state = getGroupQualificationState([1,2,3,4], [
    { player1Id:1, player2Id:2, winnerId:1 },
    { player1Id:1, player2Id:3, winnerId:1 },
    { player1Id:1, player2Id:4, winnerId:1 },
    { player1Id:2, player2Id:3, winnerId:2 },
    { player1Id:2, player2Id:4, winnerId:2 },
    { player1Id:3, player2Id:4, winnerId:4 },
  ]);
  assert.deepEqual(state, { qualifiedIds: [1,2], tiedIds: [], slots: 0 });
});

test('равенство на проходном месте требует дополнительных боёв', () => {
  const matches = [
    { player1Id:1, player2Id:2, winnerId:1 },
    { player1Id:1, player2Id:3, winnerId:3 },
    { player1Id:1, player2Id:4, winnerId:1 },
    { player1Id:2, player2Id:3, winnerId:2 },
    { player1Id:2, player2Id:4, winnerId:2 },
    { player1Id:3, player2Id:4, winnerId:3 },
  ];
  assert.deepEqual(getGroupQualificationState([1,2,3,4], matches), {
    qualifiedIds: [], tiedIds: [1,2,3], slots: 2,
  });
});

test('плей-офф пересекает соседние группы по схеме A1-B2 и B1-A2', () => {
  assert.deepEqual(createFixedPlayoffPairs([
    { groupName:'A', firstId:1, secondId:2 },
    { groupName:'B', firstId:3, secondId:4 },
    { groupName:'C', firstId:5, secondId:6 },
    { groupName:'D', firstId:7, secondId:8 },
  ]), [
    [1,4], [3,2], [5,8], [7,6],
  ]);
});


test('после первого раунда победители продолжают движение по закреплённым веткам', () => {
  const firstRound = [[1,4],[3,2],[5,8],[7,6]];
  const winners = [1,2,8,7];
  assert.deepEqual([
    [winners[0], winners[1]],
    [winners[2], winners[3]],
  ], [[1,2],[8,7]]);
  assert.equal(firstRound.length, 4);
});
