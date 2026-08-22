/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  startJob,
  type JobStartRepository,
  type JobStartTransaction,
  type LockedJobStartUser,
} from './jobStart';

const catalogJob = {
  id: 4,
  name: 'Каменоломня',
  duration: 3600,
  rewardMin: 10,
  rewardMax: 20,
  background: null,
};

function serializedRepository(initial: LockedJobStartUser) {
  let user = { ...initial };
  let queue = Promise.resolve();
  let writes = 0;
  const tx: JobStartTransaction = {
    async lockUser(userId) { return user.id === userId ? { ...user } : null; },
    async findJob(jobId) { return jobId === catalogJob.id ? catalogJob : null; },
    async findJobsByDuration(duration) { return duration === catalogJob.duration ? [catalogJob] : []; },
    async saveActiveJob(userId, activeJob) {
      assert.equal(userId, user.id);
      user = { ...user, activeJob };
      writes += 1;
    },
  };
  const repo: JobStartRepository = {
    transaction(callback) {
      const run = queue.then(() => callback(tx));
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
  return { repo, user: () => user, writes: () => writes };
}

test('два параллельных старта записывают ровно одну активную работу', async () => {
  const state = serializedRepository({
    id: 7,
    level: 2,
    faction: null,
    premiumUntil: 0,
    activeJob: null,
  });
  const input = { userId: 7, jobId: 4, now: 1000, random: () => 0 };
  const results = await Promise.all([startJob(state.repo, input), startJob(state.repo, input)]);

  assert.equal(results.filter(result => result.started).length, 1);
  assert.deepEqual(results.find(result => !result.started), { started: false, reason: 'already-active' });
  assert.equal(state.writes(), 1);
  const stored = state.user().activeJob;
  assert.ok(stored && typeof stored === 'object');
  assert.equal(stored.reward, 10);
  assert.equal(stored.endTime, 4600);
  assert.equal(stored.rewardMin, 10);
  assert.equal(stored.rewardMax, 40);
  assert.equal(stored.background, null);
});

test('сохраняет текущие crafter, premium и exp формулы', async () => {
  const state = serializedRepository({
    id: 7,
    level: 2,
    faction: 'crafter',
    premiumUntil: 2000,
    activeJob: null,
  });
  const result = await startJob(state.repo, { userId: 7, jobId: 4, now: 1000, random: () => 0 });
  assert.equal(result.started, true);
  if (!result.started) return;
  assert.equal(result.job.reward, 21, 'base 10 × crafter 2 + premium minimum 1');
  assert.equal(result.job.premiumBonus, 1);
  assert.equal(result.job.expReward, 1);
  assert.equal(result.rewardMin, 10);
  assert.equal(result.rewardMax, 40);
});
