/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  reorderInventory,
  toggleInventoryLock,
  type InventoryArrangeRepository,
  type InventoryArrangeTransaction,
} from './inventoryArrange';

function repository(initialInventory: any[]) {
  const calls: string[] = [];
  let saved: any[] | null = null;
  const tx: InventoryArrangeTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return { id: userId, inventory: JSON.stringify(initialInventory) };
    },
    async saveInventory(userId, inventory) {
      calls.push(`save:${userId}`);
      saved = inventory;
    },
  };
  const repo: InventoryArrangeRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved };
}

test('атомарно меняет порядок и удаляет дубликаты экипировки', async () => {
  const state = repository([
    { id: 'a', type: 'equipment' },
    { id: 'a', type: 'equipment' },
    { id: 'b', type: 'equipment' },
    { id: 10, type: 'craft_item', count: 3 },
  ]);

  const result = await reorderInventory(state.repo, {
    userId: 7,
    order: ['b', 'b', 'a', '10'],
  });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'save:7', 'commit']);
  assert.deepEqual(result, { success: true });
  assert.deepEqual(state.getSaved()?.map(item => item.id), ['b', 'a', 10]);
});

test('атомарно переключает блокировку выбранного предмета', async () => {
  const state = repository([
    { id: 'a', type: 'equipment', locked: false },
    { id: 'b', type: 'equipment' },
  ]);

  const result = await toggleInventoryLock(state.repo, { userId: 7, itemId: 'a' });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'save:7', 'commit']);
  assert.deepEqual(result, { success: true, locked: true });
  assert.equal(state.getSaved()?.[0]?.locked, true);
  assert.equal(state.getSaved()?.[1]?.locked, undefined);
});

test('отклоняет некорректный order до транзакции', async () => {
  const state = repository([]);

  await assert.rejects(
    reorderInventory(state.repo, { userId: 7, order: 'bad' as any }),
    /Неверный формат/,
  );
  assert.deepEqual(state.calls, []);
});

test('не сохраняет inventory при toggle неизвестного предмета', async () => {
  const state = repository([{ id: 'a', type: 'equipment' }]);

  await assert.rejects(
    toggleInventoryLock(state.repo, { userId: 7, itemId: 'missing' }),
    /Предмет не найден/,
  );
  assert.equal(state.getSaved(), null);
});
