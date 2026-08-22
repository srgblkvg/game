/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  salvageInventory,
  type InventorySalvageRepository,
  type InventorySalvageTransaction,
} from './inventorySalvage';

function repository(initialInventory: any[]) {
  const calls: string[] = [];
  let saved: any[] | null = null;
  const materials: Record<number, any> = {
    2: { id: 102, name: 'Редкий материал', rarityId: 2, type: 'material', image: null, rarityDisplay: 'Редкий', rarityColor: '#00f' },
    4: { id: 104, name: 'Эпический материал', rarityId: 4, type: 'material', image: '/epic.webp', rarityDisplay: 'Эпический', rarityColor: '#a0f' },
  };
  const tx: InventorySalvageTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return { id: userId, inventory: JSON.stringify(initialInventory) };
    },
    async findMaterial(rarityId) {
      calls.push(`find-material:${rarityId}`);
      return materials[rarityId] || null;
    },
    async saveInventory(userId, inventory) {
      calls.push(`save:${userId}`);
      saved = inventory;
    },
  };
  const repo: InventorySalvageRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved };
}

test('атомарно разбирает предметы и стакает материалы по редкости', async () => {
  const state = repository([
    { id: 'sword', type: 'equipment', rarity_id: 2 },
    { id: 'helmet', type: 'equipment', rarity_id: 4 },
    { id: 102, type: 'craft_item', count: 3 },
    { id: 'keep', type: 'equipment', rarity_id: 1 },
  ]);

  const result = await salvageInventory(state.repo, {
    userId: 7,
    itemIds: ['sword', 'helmet'],
  });

  assert.deepEqual(state.calls, [
    'begin', 'lock-user:7', 'find-material:2', 'find-material:4', 'save:7', 'commit',
  ]);
  assert.equal(result.salvagedCount, 2);
  assert.deepEqual(result.inventory.map(item => item.id), [102, 'keep', 104]);
  assert.equal(result.inventory[0]?.count, 4);
  assert.equal(result.inventory[2]?.count, 1);
  assert.deepEqual(state.getSaved(), result.inventory);
});

test('откатывает разборку, если материал редкости не настроен', async () => {
  const state = repository([
    { id: 'unknown-rarity', type: 'equipment', rarity_id: 99 },
  ]);

  await assert.rejects(
    salvageInventory(state.repo, { userId: 7, itemIds: ['unknown-rarity'] }),
    /Материал для редкости не найден/,
  );
  assert.equal(state.getSaved(), null);
});

test('отклоняет некорректный список предметов до транзакции', async () => {
  const state = repository([]);

  await assert.rejects(
    salvageInventory(state.repo, { userId: 7, itemIds: 'bad' as any }),
    /Некорректный список предметов/,
  );
  assert.deepEqual(state.calls, []);
});

test('не разбирает заблокированный предмет', async () => {
  const state = repository([
    { id: 'locked', type: 'equipment', rarity_id: 2, locked: true },
    { id: 'normal', type: 'equipment', rarity_id: 2 },
  ]);

  await assert.rejects(
    salvageInventory(state.repo, { userId: 7, itemIds: ['locked', 'normal'] }),
    /Предмет заблокирован/,
  );
  assert.equal(state.getSaved(), null);
});
