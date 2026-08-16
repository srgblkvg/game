/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateMergedPrizePools, buildQueueMergePlan, getPowerDivision, getPowerDivisionByNumber, getPowerPrizeWeight, getVisiblePowerDivision, mergeTournamentQueues, selectReadyQueueWindow } from './tournamentQueue';

const queue = (id: number, powers: number[]) => ({
  id,
  participants: powers.map((combatPower, i) => ({ userId: id * 100 + i, combatPower })),
});

test('объединяет недоборную очередь с ближайшей по БМ', () => {
  const result = mergeTournamentQueues([queue(1, [100]), queue(2, [106]), queue(3, [140])], { maxPlayers: 8, maxPowerGap: 0.15 });
  assert.deepEqual(result.groups.map(g => g.sourceQueueIds), [[1, 2]]);
  assert.deepEqual(result.cancelledQueueIds, [3]);
});

test('не объединяет игроков при разрыве БМ выше предела', () => {
  const result = mergeTournamentQueues([queue(1, [100]), queue(2, [121])], { maxPlayers: 8, maxPowerGap: 0.15 });
  assert.equal(result.groups.length, 0);
  assert.deepEqual(result.cancelledQueueIds, [1, 2]);
});

test('формирует несколько сеток максимум по восемь игроков без дубликатов', () => {
  const result = mergeTournamentQueues([queue(1, [100, 101, 102, 103, 104]), queue(2, [105, 106, 107, 108, 109])], { maxPlayers: 8, maxPowerGap: 0.15 });
  assert.deepEqual(result.groups.map(g => g.participants.length), [8, 2]);
  const ids = result.groups.flatMap(g => g.participants.map(p => p.userId));
  assert.equal(new Set(ids).size, 10);
  assert.equal(result.cancelledQueueIds.length, 0);
});

test('одиночный хвост отменяется после формирования полных совместимых групп', () => {
  const result = mergeTournamentQueues([queue(1, [100, 102, 104]), queue(2, [106, 108])], { maxPlayers: 4, maxPowerGap: 0.15 });
  assert.deepEqual(result.groups.map(g => g.participants.length), [4]);
  assert.equal(result.cancelledParticipants.length, 1);
});

test('ступени БМ покрывают диапазон без дыр и не шире пяти процентов', () => {
  for (const power of [1, 2, 10, 100, 10_000, 2_000_000]) {
    const division = getPowerDivision(power);
    assert.ok(power >= division.minPower && power <= division.maxPower);
    assert.ok((division.maxPower - division.minPower) / division.maxPower <= 0.05);
    assert.match(division.label, /^(Медный|Бронзовый|Железный|Стальной|Серебряный|Золотой|Платиновый|Мифриловый|Адамантовый|Орихалковый) (I|II|III|IV|V)$/);
  }
});

test('видимый ранг не показывает технический номер диапазона', () => {
  assert.equal(getVisiblePowerDivision(1_020_179), 'Платиновый IV');
  assert.doesNotMatch(getPowerDivision(1_020_179).label, /\d/);
});

test('фонд растёт плавно по рангу и ступени', () => {
  assert.equal(getPowerPrizeWeight(1), 1);
  assert.equal(getPowerPrizeWeight(99), 1.8);
  assert.equal(getPowerPrizeWeight(100), 2);
  assert.equal(getPowerPrizeWeight(50_000), 6);
  assert.equal(getPowerPrizeWeight(1_250_000), 8);
});

test('доля фонда отменённого игрока возвращается в казну', () => {
  const queues = [
    { ...queue(1, [100, 104]), prizePool: 1000 },
    { ...queue(2, [200]), prizePool: 500 },
  ];
  const merged = mergeTournamentQueues(queues, { maxPlayers: 8, maxPowerGap: 0.10 });
  const allocation = allocateMergedPrizePools(queues, merged.groups);
  assert.deepEqual(allocation.groupPools, [1000]);
  assert.equal(allocation.refund, 500);
  assert.equal(allocation.groupPools.reduce((sum, value) => sum + value, 0) + allocation.refund, 1500);
});

test('разные сроки старта объединяются через общее окно ожидания', () => {
  const queues = [
    { id: 1, registrationEnd: 1_000 },
    { id: 2, registrationEnd: 1_300 },
    { id: 3, registrationEnd: 1_700 },
  ];
  assert.deepEqual(selectReadyQueueWindow(queues, 1_599, 600), []);
  assert.deepEqual(selectReadyQueueWindow(queues, 1_600, 600), [1, 2]);
  assert.deepEqual(selectReadyQueueWindow(queues, 1_700, 600), [1, 2, 3]);
});

test('ступень восстанавливается по номеру без подмены номера значением БМ', () => {
  const original = getPowerDivision(10_000);
  assert.deepEqual(getPowerDivisionByNumber(original.number), original);
});

test('план переноса выбирает host и суммирует фонды donor-очередей', () => {
  const plan = buildQueueMergePlan([
    { ...queue(10, [100]), prizePool: 1000 },
    { ...queue(11, [104]), prizePool: 2000 },
    { ...queue(12, [140]), prizePool: 3000 },
  ], { maxPlayers: 8, maxPowerGap: 0.05 });
  assert.deepEqual(plan.groups[0], { hostQueueId: 10, donorQueueIds: [11], prizePool: 3000, userIds: [1000, 1100] });
  assert.deepEqual(plan.cancelledQueueIds, [12]);
});
