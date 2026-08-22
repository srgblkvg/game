/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeTutorial,
  grantTutorialCraftReward,
  grantTutorialPveReward,
  type TutorialRewardRepository,
  type TutorialRewardTransaction,
} from './tutorialRewards';

function repository(owner: any) {
  const calls: string[] = [];
  let saved: any = null;
  const tx: TutorialRewardTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return owner;
    },
    async savePveReward(userId, inventory, money, tutorialStep, lastPveAttackTime) {
      calls.push(`save:${userId}`);
      saved = { inventory, money, tutorialStep, lastPveAttackTime };
    },
    async saveCraftReward(userId, inventory, tutorialStep) {
      calls.push(`save-craft:${userId}`);
      saved = { inventory, tutorialStep };
    },
    async saveCompletion(userId, money, tutorialStep, completed) {
      calls.push(`complete:${userId}`);
      saved = { money, tutorialStep, completed };
    },
  };
  const repo: TutorialRewardRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved };
}

test('атомарно выдаёт tutorial PvE reward и переводит на шаг 1', async () => {
  const state = repository({
    id: 7, tutorialStep: 0, money: 100,
    inventory: JSON.stringify([{ id: 1, type: 'craft_item', count: 2 }]),
  });
  const sword = { id: 'sword', name: 'Стон могильщика', slot: 'weapon1' };
  const dust = { id: 1, type: 'craft_item', count: 1, name: 'Пыль забвения' };

  const result = await grantTutorialPveReward(state.repo, {
    userId: 7, sword, dust, now: 1234,
  });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'save:7', 'commit']);
  assert.equal(result.money, 105);
  assert.equal(result.inventory.find(item => item.id === 1)?.count, 3);
  assert.equal(result.inventory.filter(item => item.id === 'sword').length, 1);
  assert.deepEqual(state.getSaved(), {
    inventory: result.inventory, money: 105, tutorialStep: 1, lastPveAttackTime: 1234,
  });
});

test('не выдаёт PvE reward повторно после смены шага', async () => {
  const state = repository({ id: 7, tutorialStep: 1, money: 105, inventory: '[]' });

  await assert.rejects(grantTutorialPveReward(state.repo, {
    userId: 7,
    sword: { id: 'sword' },
    dust: { id: 1, type: 'craft_item', count: 1 },
    now: 1234,
  }), /Неверный шаг обучения/);

  assert.equal(state.getSaved(), null);
});

test('атомарно расходует пыль, создаёт щит и переводит на шаг 3', async () => {
  const state = repository({
    id: 7, tutorialStep: 2, money: 105,
    inventory: JSON.stringify([{ id: 1, type: 'craft_item', count: 2 }]),
  });
  const shield = { id: 'shield', name: 'Гробовая преграда', slot: 'shield' };

  const result = await grantTutorialCraftReward(state.repo, {
    userId: 7, shield, dustId: 1,
  });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'save-craft:7', 'commit']);
  assert.equal(result.inventory.find(item => item.id === 1)?.count, 1);
  assert.equal(result.inventory.filter(item => item.id === 'shield').length, 1);
  assert.deepEqual(state.getSaved(), { inventory: result.inventory, tutorialStep: 3 });
});

test('атомарно завершает обучение и начисляет 1000 серебра один раз', async () => {
  const state = repository({ id: 7, tutorialStep: 5, money: 105, inventory: '[]' });

  const result = await completeTutorial(state.repo, { userId: 7, reward: 1000 });

  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'complete:7', 'commit']);
  assert.deepEqual(result, { reward: 1000, money: 1105, completed: true });
  assert.deepEqual(state.getSaved(), { money: 1105, tutorialStep: 6, completed: 1 });
});
