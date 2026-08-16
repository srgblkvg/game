/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createTournamentSnapshot,
  mergeTournamentResult,
  playerFromTournamentSnapshot,
} from './tournamentSnapshot';

const player = {
  id: 659,
  name: 'Medved_Rus',
  level: 6,
  base: { s: 10, a: 12, d: 8, m: 9 },
  equipment: { weapon1: { name: 'Меч', slot: 'weapon1', bonuses: { s: 13 } } },
  stats: { s: 49, a: 47, d: 21, m: 31, hp: 254, extra: { crit: 30, dodge: 40, counter: 0, fullBlock: 25 }, rageDmg: 20 },
  drinkBonuses: { s: 1, a: 0, d: 0, m: 0 },
  collectionBonus: 3,
  guildBonus: 5,
  activeEquipSlot: 1,
  playerTalents: { accuracy: { level: 2, progress: 0 } },
  guildTalents: { accuracy: { level: 3, progress: 0 } },
  antiStats: { antiDodge: 5, antiCrit: 0, antiBlock: 0, antiCounter: 0, antiVampiric: 0 },
};

test('snapshot фиксирует полный боевой профиль при регистрации', () => {
  const snapshot = createTournamentSnapshot(player as any, 1234);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.combatPower, 1234);
  assert.deepEqual(snapshot.player.stats, player.stats);
  assert.deepEqual(snapshot.player.equipment, player.equipment);
  assert.equal(snapshot.player.guildBonus, 5);
  assert.equal(snapshot.player.collectionBonus, 3);
  assert.equal(snapshot.player.antiStats?.antiDodge, 5);
});

test('турнирный боец восстанавливается только из snapshot', () => {
  const snapshot = createTournamentSnapshot(player as any, 1234);
  const restored = playerFromTournamentSnapshot(snapshot);
  player.equipment.weapon1.bonuses.s = 999;
  player.guildBonus = 50;
  player.antiStats.antiDodge = 50;
  assert.equal((restored.equipment.weapon1 as any).bonuses.s, 13);
  assert.equal(restored.stats.s, 49);
  assert.equal(restored.currentHp, 254);
  assert.equal(restored.guildBonus, 5);
  assert.equal(restored.antiStats?.antiDodge, 5);
});

test('результат турнира дописывается без уничтожения боевого snapshot', () => {
  const snapshot = createTournamentSnapshot(player as any, 1234);
  const result = mergeTournamentResult(snapshot, 1, 5000);
  assert.equal(result.result?.place, 1);
  assert.equal(result.result?.prize, 5000);
  assert.equal(result.place, 1);
  assert.equal(result.prize, 5000);
  assert.equal(result.player.stats.s, 49);
  assert.equal(result.combatPower, 1234);
});

test('старый результат без боевого snapshot остаётся читаемым', () => {
  const result = mergeTournamentResult({ place: 2, prize: 100 } as any, 1, 500);
  assert.equal(result.result?.place, 1);
  assert.equal(result.result?.prize, 500);
});
