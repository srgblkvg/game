/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { switchEquipmentSet, type EquipmentSwitchRepository, type EquipmentSwitchTransaction } from './inventoryEquipSwitch';

function repository(userOverrides: Record<string, any> = {}) {
  const calls: string[] = [];
  let saved: any = null;
  const user = {
    id: 7,
    activeEquipSlot: 1,
    equipment: { weapon1: { id: 'active' } },
    equipmentSets: {
      1: { weapon1: { id: 'stale-one' } },
      2: { helmet: { id: 'target' } },
      3: {},
    },
    ...userOverrides,
  };
  const tx: EquipmentSwitchTransaction = {
    async lockUser(id) { calls.push(`lock:${id}`); return structuredClone(user); },
    async saveSwitch(state) { calls.push(`save:${state.oldSlot}->${state.newSlot}`); saved = structuredClone(state); },
  };
  const repo: EquipmentSwitchRepository = {
    async transaction(callback) {
      calls.push('begin');
      try { const result = await callback(tx); calls.push('commit'); return result; }
      catch (error) { calls.push('rollback'); throw error; }
    },
  };
  return { repo, calls, get saved() { return saved; } };
}

test('атомарно сохраняет текущий комплект и переключает legacy equipment', async () => {
  const state = repository();
  const result = await switchEquipmentSet(state.repo, { userId: 7, slot: 2 });
  assert.deepEqual(state.calls, ['begin', 'lock:7', 'save:1->2', 'commit']);
  assert.equal(state.saved.oldEquipment.weapon1.id, 'stale-one');
  assert.equal(state.saved.newEquipment.helmet.id, 'target');
  assert.equal(result.equipment.helmet.id, 'target');
  assert.equal(result.activeEquipSlot, 2);
});

test('текущий слот возвращает состояние без UPDATE', async () => {
  const state = repository();
  const result = await switchEquipmentSet(state.repo, { userId: 7, slot: 1 });
  assert.deepEqual(state.calls, ['begin', 'lock:7', 'commit']);
  assert.equal(state.saved, null);
  assert.equal(result.equipment.weapon1.id, 'stale-one');
});

test('использует активный equipment_N, если legacy equipment пуст', async () => {
  const state = repository({
    equipment: {},
    equipmentSets: {
      1: { weapon1: { id: 'canonical-active' } },
      2: { helmet: { id: 'target' } },
      3: {},
    },
  });
  await switchEquipmentSet(state.repo, { userId: 7, slot: 2 });
  assert.equal(state.saved.oldEquipment.weapon1.id, 'canonical-active');
});

test('невалидный слот отклоняется до транзакции', async () => {
  const state = repository();
  await assert.rejects(switchEquipmentSet(state.repo, { userId: 7, slot: 4 }), /Неверный слот/);
  assert.deepEqual(state.calls, []);
});
