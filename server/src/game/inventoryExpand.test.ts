/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expandInventory,
  type InventoryExpandRepository,
  type InventoryExpandTransaction,
} from './inventoryExpand';

function repository(owner: { id: number; inventorySlots: number; money: number } | null) {
  const calls: string[] = [];
  let saved: any = null;
  const tx: InventoryExpandTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return owner;
    },
    async saveExpansion(userId, inventorySlots, money) {
      calls.push(`save:${userId}`);
      saved = { inventorySlots, money };
    },
  };
  const repo: InventoryExpandRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved };
}

test('атомарно расширяет 10 слотов до 11 за 100 серебра', async () => {
  const state = repository({ id: 7, inventorySlots: 10, money: 1000 });

  const result = await expandInventory(state.repo, { userId: 7 });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'save:7', 'commit']);
  assert.deepEqual(result, { inventorySlots: 11, moneyAfter: 900 });
  assert.deepEqual(state.getSaved(), { inventorySlots: 11, money: 900 });
});

test('следующий слот использует удвоенную цену из заблокированного состояния', async () => {
  const state = repository({ id: 7, inventorySlots: 11, money: 1000 });

  const result = await expandInventory(state.repo, { userId: 7 });

  assert.deepEqual(result, { inventorySlots: 12, moneyAfter: 800 });
});

test('не списывает деньги при недостаточном балансе', async () => {
  const state = repository({ id: 7, inventorySlots: 11, money: 199 });

  await assert.rejects(expandInventory(state.repo, { userId: 7 }), /Недостаточно серебра/);
  assert.equal(state.getSaved(), null);
});

test('не расширяет инвентарь больше 30 слотов', async () => {
  const state = repository({ id: 7, inventorySlots: 30, money: 1_000_000_000 });

  await assert.rejects(expandInventory(state.repo, { userId: 7 }), /Достигнут максимум слотов \(30\)/);
  assert.equal(state.getSaved(), null);
});
