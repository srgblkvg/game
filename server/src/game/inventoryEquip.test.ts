/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  changeEquipment,
  type EquipmentChangeRepository,
  type EquipmentChangeTransaction,
} from './inventoryEquip';

const baseUser = {
  id: 11,
  currentHp: 20,
  baseS: 5,
  baseA: 5,
  baseD: 5,
  baseM: 5,
  inventory: [] as Record<string, any>[],
  equipment: {} as Record<string, any>,
  activeEquipSlot: 2,
};

function repository(user = baseUser) {
  const calls: string[] = [];
  let saved: any = null;
  const tx: EquipmentChangeTransaction = {
    async lockUser(userId) { calls.push(`lock:${userId}`); return structuredClone(user); },
    async saveState(state) { calls.push(`save:${state.userId}:${state.activeEquipSlot}`); saved = structuredClone(state); },
  };
  const repo: EquipmentChangeRepository = {
    async transaction(callback) {
      calls.push('begin');
      try { const result = await callback(tx); calls.push('commit'); return result; }
      catch (error) { calls.push('rollback'); throw error; }
    },
  };
  return { repo, calls, get saved() { return saved; } };
}

const bonuses = { drinkBonuses: { s: 0, a: 0, d: 0, m: 0 }, collectionBonus: 0, guildBonus: 0 };

test('экипирует предмет и атомарно сохраняет активный комплект', async () => {
  const sword = { id: 'sword', name: 'Меч', slot: 'weapon1', bonuses: { s: 5, a: 0, d: 0, m: 0 } };
  const state = repository({ ...baseUser, inventory: [sword] });
  const result = await changeEquipment(state.repo, {
    userId: 11, slotId: 'weapon1', itemId: 'sword', now: 1000, ...bonuses,
  });

  assert.deepEqual(state.calls, ['begin', 'lock:11', 'save:11:2', 'commit']);
  assert.equal(result.inventory.length, 0);
  assert.equal(result.equipment.weapon1.id, 'sword');
  assert.equal(state.saved.activeEquipSlot, 2);
  assert.equal(state.saved.equipment.weapon1.id, 'sword');
});

test('заменяет экипированный предмет и возвращает старый в inventory', async () => {
  const oldSword = { id: 'old', name: 'Старый меч', slot: 'weapon1', bonuses: { s: 1, a: 0, d: 0, m: 0 } };
  const newSword = { id: 'new', name: 'Новый меч', slot: 'weapon1', bonuses: { s: 3, a: 0, d: 0, m: 0 } };
  const state = repository({ ...baseUser, inventory: [newSword], equipment: { weapon1: oldSword } });
  const result = await changeEquipment(state.repo, {
    userId: 11, slotId: 'weapon1', itemId: 'new', now: 1000, ...bonuses,
  });

  assert.equal(result.equipment.weapon1.id, 'new');
  assert.deepEqual(result.inventory.map(item => item.id), ['old']);
});

test('снимает предмет и сохраняет его в inventory', async () => {
  const helmet = { id: 'helm', name: 'Шлем', slot: 'helmet', bonuses: { s: 0, a: 1, d: 0, m: 0 } };
  const state = repository({ ...baseUser, equipment: { helmet } });
  const result = await changeEquipment(state.repo, {
    userId: 11, slotId: 'helmet', itemId: null, now: 1000, ...bonuses,
  });

  assert.equal(result.equipment.helmet, undefined);
  assert.ok(result.inventory[0]);
  assert.equal(result.inventory[0].id, 'helm');
});

test('не экипирует заблокированный предмет', async () => {
  const item = { id: 'locked', name: 'Меч', slot: 'weapon1', locked: true };
  const state = repository({ ...baseUser, inventory: [item] });
  await assert.rejects(
    changeEquipment(state.repo, { userId: 11, slotId: 'weapon1', itemId: 'locked', now: 1000, ...bonuses }),
    /Предмет заблокирован/,
  );
  assert.equal(state.saved, null);
  assert.equal(state.calls[state.calls.length - 1], 'rollback');
});

test('не позволяет надеть два одинаковых кольца', async () => {
  const ring = { id: 'ring-new', name: 'Кольцо тумана', slot: 'ring' };
  const other = { id: 'ring-old', name: 'Кольцо тумана', slot: 'ring' };
  const state = repository({ ...baseUser, inventory: [ring], equipment: { ring1: other } });
  await assert.rejects(
    changeEquipment(state.repo, { userId: 11, slotId: 'ring2', itemId: 'ring-new', now: 1000, ...bonuses }),
    /два одинаковых кольца/,
  );
});

test('двуручное оружие снимает щит в inventory', async () => {
  const weapon = { id: 'two', name: 'двуручный меч', slot: 'weapon1' };
  const shield = { id: 'shield', name: 'Щит', slot: 'shield' };
  const state = repository({ ...baseUser, inventory: [weapon], equipment: { shield } });
  const result = await changeEquipment(state.repo, {
    userId: 11, slotId: 'weapon1', itemId: 'two', now: 1000, ...bonuses,
  });
  assert.equal(result.equipment.shield, undefined);
  assert.deepEqual(result.inventory.map(item => item.id), ['shield']);
});

test('отклоняет неизвестный слот экипировки', async () => {
  const state = repository();
  await assert.rejects(
    changeEquipment(state.repo, { userId: 11, slotId: 'admin', itemId: null, now: 1000, ...bonuses }),
    /Некорректный слот экипировки/,
  );
  assert.deepEqual(state.calls, []);
});
