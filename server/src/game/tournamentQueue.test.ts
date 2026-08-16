/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQueueMergePlan, getPowerDivision, getPowerDivisionByNumber, getVisiblePowerDivision, mergeTournamentQueues } from './tournamentQueue';

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
