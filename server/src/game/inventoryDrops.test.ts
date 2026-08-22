/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  grantInventoryDrops,
  type InventoryDropRepository,
  type InventoryDropTransaction,
} from './inventoryDrops';

function repository(initialInventory: any[]) {
  const calls: string[] = [];
  let saved: any[] | null = null;
  const tx: InventoryDropTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return { id: userId, inventory: JSON.stringify(initialInventory) };
    },
    async saveInventory(userId, inventory) {
      calls.push(`save:${userId}`);
      saved = inventory;
    },
  };
  const repo: InventoryDropRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved };
}

test('атомарно выдаёт все дропы, стакая только ресурсы', async () => {
  const state = repository([
    { id: 10, type: 'craft_item', count: 2 },
    { id: 'old-equipment', slot: 'helmet' },
  ]);
  const newEquipment = { id: 'new-equipment', slot: 'weapon1' };

  const result = await grantInventoryDrops(state.repo, {
    userId: 7,
    drops: [
      { id: 10, type: 'craft_item', count: 1 },
      { id: 10, type: 'craft_item', count: 2 },
      newEquipment,
    ],
  });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'save:7', 'commit']);
  assert.equal(result.inventory.find(item => item.id === 10)?.count, 5);
  assert.equal(result.inventory.filter(item => item.id === 'new-equipment').length, 1);
  assert.deepEqual(state.getSaved(), result.inventory);
});

test('сохраняет строгую идентичность id и стакает только craft_item', async () => {
  const state = repository([
    { id: '10', type: 'craft_item', count: 4 },
    { id: 'material', type: 'material', count: 2 },
  ]);

  const result = await grantInventoryDrops(state.repo, {
    userId: 7,
    drops: [
      { id: 10, type: 'craft_item', count: 1 },
      { id: 'material', type: 'material', count: 1 },
    ],
  });

  assert.equal(result.inventory.filter(item => item.id === '10').length, 1);
  assert.equal(result.inventory.filter(item => item.id === 10).length, 1);
  assert.equal(result.inventory.filter(item => item.id === 'material').length, 2);
});

test('пустой список дропов не открывает транзакцию', async () => {
  const state = repository([]);

  const result = await grantInventoryDrops(state.repo, { userId: 7, drops: [] });

  assert.deepEqual(result, { inventory: [] });
  assert.deepEqual(state.calls, []);
});
