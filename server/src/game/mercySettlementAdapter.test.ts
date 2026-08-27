/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMercySettlementAdapter, type MercySettlementAdapterInput } from './mercySettlementAdapter';
import type { PvpSettlementV2Result } from './pvpSettlementV2';

const input = (overrides: Partial<MercySettlementAdapterInput> = {}): MercySettlementAdapterInput => ({
  attackerId: 10,
  defenderId: 20,
  expGained: 2,
  attackerEloDelta: 13,
  defenderEloDelta: -9,
  attackerHpAfter: 87,
  defenderHpAfter: 0,
  historyLog: ['attacker overwhelms defender'],
  log: ['attacker vs defender', 'defender yields'],
  steps: (actual: number) => [{ type: 'mercy', message: `defender yields ${actual}` }],
  plannedMoneyStolen: 25,
  now: 1234,
  karmaDelta: -1,
  banditReputationDelta: 1,
  ...overrides,
});

const settlementResult = (levelsGained: number): PvpSettlementV2Result => ({
  users: {
    10: { money: 120, exp: 1, level: 4, statpoints: 15, elo: 1013, levelsGained },
    20: { money: 0, exp: 4, level: 2, statpoints: 5, elo: 991, levelsGained: 0 },
  },
  tax: { netIncome: 23, guildId: 7, tax: 2 },
  plannedMoneyStolen: 25,
  actualMoneyStolen: 8,
});

test('builds a pure mercy plan with attacker and defender field semantics', () => {
  const result = buildMercySettlementAdapter(input());

  assert.equal(result instanceof Promise, false);
  assert.deepEqual(result.plan.outcome, {
    kind: 'mercy', attackerId: 10, defenderId: 20, winnerId: 10, loserId: 20,
  });
  assert.deepEqual(result.plan.userPlans.map(plan => ({
    userId: plan.userId,
    expGain: plan.expGain,
    eloDelta: plan.eloDelta,
    hpAfter: plan.hpAfter,
    karmaDelta: plan.karmaDelta,
    banditReputationDelta: plan.banditReputationDelta,
  })), [
    { userId: 10, expGain: 2, eloDelta: 13, hpAfter: 87, karmaDelta: -1, banditReputationDelta: 1 },
    { userId: 20, expGain: 0, eloDelta: -9, hpAfter: 0, karmaDelta: undefined, banditReputationDelta: undefined },
  ]);
  assert.equal(typeof result.plan.history.steps, 'function');
  assert.deepEqual({ ...result.plan.history, steps: undefined }, {
    attackerId: 10,
    defenderId: 20,
    winnerId: 10,
    log: ['attacker overwhelms defender'],
    steps: undefined,
    attackerHpAfter: 87,
    defenderHpAfter: 0,
    expGained: 2,
    moneyGained: 25,
    moneyStolen: 25,
  });
  assert.equal(result.plan.userPlans.every((userPlan: { persistHp?: boolean }) => userPlan.persistHp === false), true);
});

test('maps route metadata and defers levels gained to the settlement result', () => {
  const result = buildMercySettlementAdapter(input());

  assert.deepEqual(result.responseMetadata.static, {
    mercy: true,
    winnerId: 10,
    hpAfter: 87,
    hpDefenderAfter: 0,
    expGained: 2,
    log: ['attacker vs defender', 'defender yields'],
  });
  assert.equal(result.responseMetadata.levelsGained(settlementResult(3)), 3);
  assert.deepEqual(result.responseMetadata.steps(8), [{ type: 'mercy', message: 'defender yields 8' }]);
});

test('keeps planned steal only in the plan and does not invent an actual amount before lock', () => {
  const result = buildMercySettlementAdapter(input({ plannedMoneyStolen: 25 }));

  assert.equal(result.plan.taxPlan?.grossIncome, 25);
  assert.equal(result.plan.history.moneyStolen, 25);
  assert.equal('actualMoneyStolen' in result, false);
  assert.equal('moneyGained' in result.responseMetadata.static, false);
  assert.equal('moneyStolen' in result.responseMetadata.static, false);
});

test('keeps opponent data outside the adapter contract', () => {
  const result = buildMercySettlementAdapter(input());
  assert.equal('opponent' in result.responseMetadata.static, false);
  assert.equal('opponent' in result, false);
});
