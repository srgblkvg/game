/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addInventoryItemToCollection,
  type CollectionAddRepository,
  type CollectionAddTransaction,
} from './collectionAdd';

function repository(inventory: any[], existing = false, allowed = true) {
  const calls: string[] = [];
  let saved: any[] | null = null;
  let inserted: any = null;
  const tx: CollectionAddTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return { id: userId, inventory: JSON.stringify(inventory) };
    },
    async hasCollectionItem(userId, itemName, slot, rarityId, plusTab) {
      calls.push(`check:${userId}:${plusTab}`);
      return existing;
    },
    async isCollectionSetItem(itemName, slot, rarityId) {
      calls.push(`allowed:${itemName}:${slot}:${rarityId}`);
      return allowed;
    },
    async saveInventory(userId, nextInventory) {
      calls.push(`save:${userId}`);
      saved = nextInventory;
    },
    async insertCollectionItem(userId, itemName, slot, rarityId, upgradeLevel) {
      calls.push(`insert:${userId}`);
      inserted = { userId, itemName, slot, rarityId, upgradeLevel };
    },
  };
  const repo: CollectionAddRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved, getInserted: () => inserted };
}

test('атомарно переносит точный предмет из inventory в коллекцию', async () => {
  const selected = {
    id: 'selected', name: 'Меч', slot: 'weapon1', rarity_id: 3,
    upgradeLevel: 7, locked: false,
  };
  const state = repository([selected, { id: 'keep', name: 'Шлем', slot: 'helmet' }]);

  const result = await addInventoryItemToCollection(state.repo, {
    userId: 7,
    itemName: 'Меч',
    slot: 'weapon1',
    itemId: 'selected',
    requestedRarityId: 1,
    targetLevel: 7,
  });

  assert.deepEqual(state.calls, [
    'begin', 'lock-user:7', 'allowed:Меч:weapon1:3', 'check:7:true', 'save:7', 'insert:7', 'commit',
  ]);
  assert.deepEqual(result, { success: true, removed: selected });
  assert.deepEqual(state.getSaved()?.map(item => item.id), ['keep']);
  assert.deepEqual(state.getInserted(), {
    userId: 7,
    itemName: 'Меч',
    slot: 'weapon1',
    rarityId: 3,
    upgradeLevel: 7,
  });
});

test('не удаляет предмет, отсутствующий в справочнике коллекции', async () => {
  const item = { id: 'outsider', name: 'Чужой предмет', slot: 'weapon1', rarity_id: 3 };
  const state = repository([item], false, false);

  await assert.rejects(addInventoryItemToCollection(state.repo, {
    userId: 7,
    itemName: item.name,
    slot: item.slot,
    itemId: item.id,
    targetLevel: 0,
  }), /Предмет не входит в коллекцию/);

  assert.equal(state.getSaved(), null);
  assert.equal(state.getInserted(), null);
});

test('не удаляет предмет, уже находящийся в выбранной вкладке коллекции', async () => {
  const item = { id: 'duplicate', name: 'Меч', slot: 'weapon1', rarity_id: 3 };
  const state = repository([item], true, true);

  await assert.rejects(addInventoryItemToCollection(state.repo, {
    userId: 7,
    itemName: item.name,
    slot: item.slot,
    itemId: item.id,
    targetLevel: 0,
  }), /Предмет уже в коллекции/);

  assert.equal(state.getSaved(), null);
  assert.equal(state.getInserted(), null);
});

test('не переносит предмет +7 в базовую вкладку', async () => {
  const item = { id: 'plus-seven', name: 'Меч', slot: 'weapon1', rarity_id: 3, upgradeLevel: 7 };
  const state = repository([item]);

  await assert.rejects(addInventoryItemToCollection(state.repo, {
    userId: 7,
    itemName: item.name,
    slot: item.slot,
    itemId: item.id,
    targetLevel: 0,
  }), /Предметы \+7 и выше нельзя добавить в базовую коллекцию/);

  assert.equal(state.getSaved(), null);
  assert.equal(state.getInserted(), null);
});
