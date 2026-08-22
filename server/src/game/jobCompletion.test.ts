/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cancelJob,
  completeJob,
  jobIdentity,
  type JobCompletionRepository,
  type JobCompletionTransaction,
  type LockedJobUser,
} from './jobCompletion';

function repository(initialUser: LockedJobUser, taxRate: number | null = null) {
  let user = structuredClone(initialUser);
  const calls: string[] = [];
  const histories: any[] = [];
  const taxes: any[] = [];
  const tx: JobCompletionTransaction = {
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return user.id === userId ? structuredClone(user) : null;
    },
    async lockGuildForTax(userId) {
      calls.push(`lock-guild:${userId}`);
      return taxRate === null ? null : { guildId: 9, taxRate };
    },
    async saveCompletedUser(settlement) {
      calls.push(`save-user:${settlement.userId}`);
      user = { ...user, ...settlement, activeJob: null };
    },
    async addGuildTax(entry) {
      calls.push(`tax:${entry.guildId}`);
      taxes.push(entry);
    },
    async addHistory(entry) {
      calls.push(`history:${entry.userId}`);
      histories.push(entry);
    },
    async clearActiveJob(userId) {
      calls.push(`cancel:${userId}`);
      user = { ...user, activeJob: null };
    },
  };
  const repo: JobCompletionRepository = {
    async transaction(callback) {
      calls.push('begin');
      const result = await callback(tx);
      calls.push('commit');
      return result;
    },
  };
  return { repo, calls, histories, taxes, user: () => user };
}

const activeJob = {
  jobId: 12,
  name: 'Каменоломня',
  startTime: 1_000,
  endTime: 2_000,
  reward: 101,
  duration: 1_000,
  expReward: 15,
  premiumBonus: 3,
};

function user(): LockedJobUser {
  return {
    id: 7,
    activeJob: JSON.stringify(activeJob),
    money: 500,
    exp: 5,
    level: 1,
    statPoints: 2,
    expEnabled: true,
    totalJobMoney: 20,
    totalJobSeconds: 30,
    oauthProvider: 'vk',
    oauthId: 'vk-7',
  };
}

test('expired mode leaves a pending job untouched', async () => {
  const state = repository(user(), 10);

  const result = await completeJob(state.repo, {
    userId: 7,
    now: 1_999,
    mode: 'expired',
    expectedJobIdentity: jobIdentity(activeJob),
  });

  assert.deepEqual(result, { completed: false, reason: 'pending' });
  assert.deepEqual(state.calls, ['begin', 'lock-user:7', 'commit']);
  assert.equal(state.user().activeJob, JSON.stringify(activeJob));
  assert.equal(state.histories.length, 0);
  assert.equal(state.taxes.length, 0);
});

test('settles one expired job with one in-transaction tax, history and totals update', async () => {
  const state = repository(user(), 10);

  const result = await completeJob(state.repo, {
    userId: 7,
    now: 2_000,
    mode: 'expired',
    expectedJobIdentity: jobIdentity(activeJob),
  });

  assert.equal(result.completed, true);
  if (!result.completed) return;
  assert.deepEqual(result, {
    completed: true,
    userId: 7,
    job: activeJob,
    grossReward: 101,
    tax: 10,
    rewardAfterTax: 91,
    money: 591,
    exp: 10,
    level: 2,
    statPoints: 7,
    levelsGained: 1,
    xpGained: 15,
    guildId: 9,
    oauthProvider: 'vk',
    oauthId: 'vk-7',
  });
  assert.deepEqual(state.calls, [
    'begin', 'lock-user:7', 'lock-guild:7', 'tax:9', 'save-user:7', 'history:7', 'commit',
  ]);
  assert.equal(state.user().money, 591, 'start did not deduct reward, so completion adds net reward');
  assert.equal(state.user().totalJobMoney, 121);
  assert.equal(state.user().totalJobSeconds, 1_030);
  assert.equal(state.taxes.length, 1);
  assert.equal(state.histories.length, 1);
});

test('repeat completion is a no-op after the first settlement', async () => {
  const state = repository(user(), 10);
  const input = {
    userId: 7,
    now: 2_000,
    mode: 'expired' as const,
    expectedJobIdentity: jobIdentity(activeJob),
  };

  const first = await completeJob(state.repo, input);
  const second = await completeJob(state.repo, input);

  assert.equal(first.completed, true);
  assert.deepEqual(second, { completed: false, reason: 'no-active-job' });
  assert.equal(state.histories.length, 1);
  assert.equal(state.taxes.length, 1);
  assert.equal(state.user().money, 591);
});

test('job identity включает payout-critical поля', () => {
  const changedReward = { ...activeJob, reward: activeJob.reward + 1 };
  const changedExp = { ...activeJob, expReward: (activeJob.expReward || 0) + 1 };
  assert.notEqual(jobIdentity(activeJob), jobIdentity(changedReward));
  assert.notEqual(jobIdentity(activeJob), jobIdentity(changedExp));
  const { expReward: _exp, premiumBonus: _premium, ...legacy } = activeJob;
  assert.equal(jobIdentity(legacy), jobIdentity({ ...legacy, expReward: 0, premiumBonus: 0 }));
});

test('force mode bypasses end time but still rechecks job identity', async () => {
  const state = repository(user(), null);
  const stale = await completeJob(state.repo, {
    userId: 7,
    now: 1_500,
    mode: 'force',
    expectedJobIdentity: '12:999',
  });
  assert.deepEqual(stale, { completed: false, reason: 'job-changed' });
  assert.equal(state.histories.length, 0);

  const forced = await completeJob(state.repo, {
    userId: 7,
    now: 1_500,
    mode: 'force',
    expectedJobIdentity: jobIdentity(activeJob),
  });
  assert.equal(forced.completed, true);
});

test('cancel and settlement serialize on the same user lock so only one wins', async () => {
  const a = repository(user(), null);
  assert.equal((await completeJob(a.repo, { userId: 7, now: 2000, mode: 'expired', expectedJobIdentity: jobIdentity(activeJob) })).completed, true);
  assert.deepEqual(await cancelJob(a.repo, { userId: 7 }), { cancelled: false, reason: 'no-active-job' });
  const b = repository(user(), null);
  assert.equal((await cancelJob(b.repo, { userId: 7, expectedJobIdentity: jobIdentity(activeJob) })).cancelled, true);
  assert.deepEqual(await completeJob(b.repo, { userId: 7, now: 2000, mode: 'expired', expectedJobIdentity: jobIdentity(activeJob) }), { completed: false, reason: 'no-active-job' });
  assert.equal(b.histories.length, 0);
});
