/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceTutorialArenaStep,
  advanceTutorialEquipmentStep,
  type TutorialProgressRepository,
  type TutorialProgressTransaction,
} from './tutorialProgress';

function repository(owner: any) {
  const calls: string[] = [];
  let saved: any = null;
  const tx: TutorialProgressTransaction = {
    async lockUser(userId) { calls.push(`lock:${userId}`); return owner; },
    async saveStep(userId, step) { calls.push(`save:${userId}`); saved = { step }; },
    async saveArenaStep(userId, step, lastPvpTime) {
      calls.push(`arena:${userId}`);
      saved = { step, lastPvpTime };
    },
  };
  const repo: TutorialProgressRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, getSaved: () => saved };
}

test('проверяет меч в активном комплекте под lock и переводит на шаг 2', async () => {
  const state = repository({
    id: 7, tutorialStep: 1, activeEquipSlot: 2,
    equipment: { weapon1: { id: 'stale' } },
    equipment1: {},
    equipment2: { weapon1: { id: 'active-sword' } },
    equipment3: {},
  });

  const result = await advanceTutorialEquipmentStep(state.repo, {
    userId: 7, expectedStep: 1, nextStep: 2, requiredSlot: 'weapon1',
    missingMessage: 'Сначала наденьте меч',
  });

  assert.deepEqual(result, { success: true, nextStep: 2 });
  assert.deepEqual(state.calls, ['begin', 'lock:7', 'save:7', 'commit']);
  assert.deepEqual(state.getSaved(), { step: 2 });
});

test('не использует legacy equipment вместо непустого активного комплекта', async () => {
  const state = repository({
    id: 7, tutorialStep: 1, activeEquipSlot: 2,
    equipment: { weapon1: { id: 'legacy-sword' } },
    equipment1: {}, equipment2: { shield: { id: 'active-shield' } }, equipment3: {},
  });

  await assert.rejects(advanceTutorialEquipmentStep(state.repo, {
    userId: 7, expectedStep: 1, nextStep: 2, requiredSlot: 'weapon1',
    missingMessage: 'Сначала наденьте меч',
  }), /Сначала наденьте меч/);
  assert.equal(state.getSaved(), null);
});

test('атомарно переводит arena tutorial на шаг 5 и сохраняет cooldown', async () => {
  const state = repository({
    id: 7, tutorialStep: 4, activeEquipSlot: 1,
    equipment: {}, equipment1: {}, equipment2: {}, equipment3: {},
  });

  const result = await advanceTutorialArenaStep(state.repo, { userId: 7, now: 5678 });

  assert.deepEqual(result, { success: true, nextStep: 5 });
  assert.deepEqual(state.calls, ['begin', 'lock:7', 'arena:7', 'commit']);
  assert.deepEqual(state.getSaved(), { step: 5, lastPvpTime: 5678 });
});
