/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  payDungeonLoot,
  restartDungeonRunAfterFailedPayout,
  type DungeonPayoutRepository,
  type DungeonPayoutTransaction,
} from './dungeonPayout';

test('после rollback запускает новый tick timer для возвращённого похода', () => {
  const oldTimer = { id: 'old' } as any;
  const newTimer = { id: 'new' } as any;
  const run = { tickTimer: oldTimer };
  let starts = 0;

  restartDungeonRunAfterFailedPayout(run, () => {
    starts += 1;
    return newTimer;
  });

  assert.equal(starts, 1);
  assert.equal(run.tickTimer, newTimer);
});

function repository(initialInventory: any[], money = 100) {
  const calls: string[] = [];
  let saved: any = null;
  const pages: number[] = [];
  let runProgress: any = null;
  const tx: DungeonPayoutTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return { id: userId, inventory: JSON.stringify(initialInventory), money };
    },
    async saveUserReward(userId, nextMoney, inventory) {
      calls.push(`save-user:${userId}`);
      saved = { money: nextMoney, inventory };
    },
    async addSkillPage(userId, skillId) {
      calls.push(`page:${userId}:${skillId}`);
      pages.push(skillId);
    },
    async updateRunProgress(userId, startedAt, maxFloor, maxReward) {
      calls.push(`run:${userId}`);
      runProgress = { userId, startedAt, maxFloor, maxReward };
    },
  };
  const repo: DungeonPayoutRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, pages, getSaved: () => saved, getRunProgress: () => runProgress };
}

test('атомарно выдаёт серебро, предметы, страницы и обновляет поход', async () => {
  const state = repository([
    { id: 10, type: 'craft_item', count: 2 },
    { id: 'old', slot: 'helmet' },
  ]);
  const loot = {
    silver: 50,
    items: [
      { id: 10, type: 'craft_item', count: 3 },
      { id: 'new', slot: 'weapon1' },
    ],
    pages: [{ skillId: 2 }, { skillId: 4 }],
  };

  const result = await payDungeonLoot(state.repo, {
    userId: 7,
    loot,
    currentFloor: 12,
    startedAt: 1234,
  });

  assert.deepEqual(state.calls, [
    'begin', 'lock-user:7', 'save-user:7', 'page:7:2', 'page:7:4', 'run:7', 'commit',
  ]);
  assert.equal(result.money, 150);
  assert.equal(result.inventory.find(item => item.id === 10)?.count, 5);
  assert.equal(result.inventory.filter(item => item.id === 'new').length, 1);
  assert.deepEqual(state.pages, [2, 4]);
  assert.deepEqual(state.getSaved(), { money: 150, inventory: result.inventory });
  assert.deepEqual(state.getRunProgress(), {
    userId: 7, startedAt: 1234, maxFloor: 12, maxReward: 50,
  });
});

test('сохраняет прежнюю нормализацию количества минимум до одного', async () => {
  const state = repository([{ id: 10, type: 'craft_item', count: 0 }]);

  const result = await payDungeonLoot(state.repo, {
    userId: 7,
    loot: { silver: 0, items: [{ id: 10, type: 'craft_item', count: 0 }], pages: [] },
    currentFloor: 1,
    startedAt: 1,
  });

  assert.equal(result.inventory[0]?.count, 2);
});
