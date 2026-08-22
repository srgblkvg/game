/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeTutorial,
  type TutorialRewardOwner,
  type TutorialRewardRepository,
  type TutorialRewardTransaction,
} from './tutorialRewards';

function statefulRepository(initialOwner: TutorialRewardOwner & { tutorialCompleted: number }) {
  const owner = { ...initialOwner };
  let totalGranted = 0;
  let completionWrites = 0;

  const tx: TutorialRewardTransaction = {
    async lockUser(userId) {
      assert.equal(userId, owner.id);
      return { ...owner };
    },
    async savePveReward() {
      throw new Error('unexpected PvE write');
    },
    async saveCraftReward() {
      throw new Error('unexpected craft write');
    },
    async saveCompletion(userId, money, tutorialStep, completed) {
      assert.equal(userId, owner.id);
      totalGranted += money - owner.money;
      completionWrites += 1;
      owner.money = money;
      owner.tutorialStep = tutorialStep;
      owner.tutorialCompleted = completed;
    },
  };

  const repo: TutorialRewardRepository = {
    async transaction(callback) {
      return callback(tx);
    },
  };

  return {
    repo,
    owner,
    getTotalGranted: () => totalGranted,
    getCompletionWrites: () => completionWrites,
  };
}

test('обе completion-цепочки делят одну идемпотентную награду', async () => {
  const state = statefulRepository({
    id: 7,
    tutorialStep: 5,
    tutorialCompleted: 0,
    money: 100,
    inventory: '[]',
  });

  const first = await completeTutorial(state.repo, { userId: 7, reward: 1000 });
  const second = await completeTutorial(state.repo, { userId: 7, reward: 1000 });

  assert.equal(first.reward, 1000);
  assert.equal(second.reward, 0);
  assert.equal(state.getTotalGranted(), 1000);
  assert.equal(state.getCompletionWrites(), 1);
  assert.equal(state.owner.money, 1100);
  assert.equal(state.owner.tutorialCompleted, 1);
});

test('уже завершённое обучение не выдаёт reward даже при последнем шаге', async () => {
  const state = statefulRepository({
    id: 7,
    tutorialStep: 5,
    tutorialCompleted: 1,
    money: 1100,
    inventory: '[]',
  });

  const result = await completeTutorial(state.repo, { userId: 7, reward: 1000 });

  assert.deepEqual(result, { reward: 0, money: 1100, completed: true });
  assert.equal(state.getTotalGranted(), 0);
  assert.equal(state.getCompletionWrites(), 0);
});

test('completion запрещён до серверно подтверждённого последнего шага', async () => {
  const state = statefulRepository({
    id: 7,
    tutorialStep: 4,
    tutorialCompleted: 0,
    money: 100,
    inventory: '[]',
  });

  await assert.rejects(
    completeTutorial(state.repo, { userId: 7, reward: 1000 }),
    /Неверный шаг обучения/,
  );
  assert.equal(state.getTotalGranted(), 0);
  assert.equal(state.getCompletionWrites(), 0);
});

test('legacy passive completion разрешён только на последнем экране 3', async () => {
  const state = statefulRepository({
    id: 7,
    tutorialStep: 3,
    tutorialCompleted: 0,
    money: 100,
    inventory: '[]',
  });

  const result = await completeTutorial(state.repo, {
    userId: 7,
    reward: 1000,
    requiredStep: 3,
  });

  assert.equal(result.reward, 1000);
  assert.equal(state.owner.money, 1100);
  assert.equal(state.owner.tutorialCompleted, 1);
});
