/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  skipTutorial,
  type TutorialRewardRepository,
  type TutorialRewardTransaction,
} from './tutorialRewards';

test('skip завершает обучение без reward на любом незавершённом шаге', async () => {
  const owner = {
    id: 7,
    tutorialStep: 0,
    tutorialCompleted: 0,
    money: 100,
    inventory: '[]',
  };
  let saved: { money: number; tutorialStep: number; completed: number } | null = null;
  const tx: TutorialRewardTransaction = {
    async lockUser() { return { ...owner }; },
    async savePveReward() { throw new Error('unexpected PvE write'); },
    async saveCraftReward() { throw new Error('unexpected craft write'); },
    async saveCompletion(_userId, money, tutorialStep, completed) {
      saved = { money, tutorialStep, completed };
    },
  };
  const repo: TutorialRewardRepository = {
    async transaction(callback) { return callback(tx); },
  };

  const result = await skipTutorial(repo, { userId: 7 });

  assert.deepEqual(result, { reward: 0, money: 100, completed: true });
  assert.deepEqual(saved, { money: 100, tutorialStep: 6, completed: 1 });
});
