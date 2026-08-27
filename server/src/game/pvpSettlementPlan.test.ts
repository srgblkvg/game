import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPvpSettlementPlan, type PvpPlanInput } from './pvpSettlementPlan';

const input = (overrides: Partial<PvpPlanInput> = {}): PvpPlanInput => ({
  kind: 'regular',
  attackerId: 10,
  defenderId: 20,
  winnerId: 10,
  plannedMoneyStolen: 15,
  expGained: 2,
  attackerEloDelta: 12,
  defenderEloDelta: -12,
  attackerHpAfter: 80,
  defenderHpAfter: 0,
  now: 1000,
  attackerLog: ['a wins'],
  battleSteps: [{ type: 'end', message: 'a wins' }],
  ...overrides,
});

test('builds regular attacker-win settlement plan', () => {
  const plan = buildPvpSettlementPlan(input());
  assert.deepEqual(plan.outcome, {
    kind: 'regular', attackerId: 10, defenderId: 20, winnerId: 10, loserId: 20,
  });
  assert.deepEqual(plan.taxPlan, { recipientId: 10, grossIncome: 15, source: 'tax_pvp' });
  assert.deepEqual(plan.userPlans[0], {
    userId: 10, moneyDelta: 15, battlesDelta: 1, winsDelta: 1,
    seasonWinsDelta: 1, seasonLossesDelta: 0, pvpMoneyWonDelta: 15,
    pvpMoneyLostDelta: 0, expGain: 2, eloDelta: 12, hpAfter: 80,
    lastAttackTime: 1000, lastHpUpdate: 1000, lastPvpTime: 1000, arenaOpponentId: null,
  });
  assert.equal(plan.userPlans[1].moneyDelta, -15);
  assert.equal(plan.userPlans[1].winsDelta, 0);
  assert.equal(plan.userPlans[1].protectionUntil, 4600);
  assert.deepEqual(plan.history, {
    attackerId: 10, defenderId: 20, winnerId: 10, log: ['a wins'],
    steps: [{ type: 'end', message: 'a wins' }], attackerHpAfter: 80,
    defenderHpAfter: 0, expGained: 2, moneyGained: 15, moneyStolen: 15,
  });
});

test('builds symmetric defender-win plan and taxes the winner', () => {
  const plan = buildPvpSettlementPlan(input({
    winnerId: 20, plannedMoneyStolen: 7, expGained: 1,
    attackerEloDelta: -8, defenderEloDelta: 8, attackerHpAfter: 0, defenderHpAfter: 60,
  }));
  assert.equal(plan.outcome.loserId, 10);
  assert.equal(plan.taxPlan?.recipientId, 20);
  assert.deepEqual(plan.userPlans.map(p => [p.userId, p.moneyDelta, p.winsDelta, p.seasonWinsDelta, p.seasonLossesDelta, p.expGain]), [
    [10, -7, 0, 0, 1, 0], [20, 7, 1, 1, 0, 1],
  ]);
});

test('mercy plan preserves explicit outcome and zero-income no-tax semantics', () => {
  const plan = buildPvpSettlementPlan(input({ kind: 'mercy', plannedMoneyStolen: 0, expGained: 1, persistHp: false }));
  assert.equal(plan.outcome.kind, 'mercy');
  assert.equal(plan.taxPlan, null);
  assert.equal(plan.history.moneyGained, 0);
  assert.equal(plan.history.moneyStolen, 0);
  assert.equal(plan.userPlans[0].persistHp, false);
  assert.equal(plan.userPlans[1].persistHp, false);
  assert.equal(plan.userPlans[0].lastPvpTime, 1000);
  assert.equal(plan.userPlans[1].lastPvpTime, 1000);
  assert.equal(plan.userPlans[1].lastHpUpdate, undefined);
});

test('adds optional winner faction deltas only to the winner plan', () => {
  const plan = buildPvpSettlementPlan(input({ karmaDelta: 1, banditReputationDelta: 1 }));
  assert.equal(plan.userPlans[0].karmaDelta, 1);
  assert.equal(plan.userPlans[0].banditReputationDelta, 1);
  assert.equal(plan.userPlans[1].karmaDelta, undefined);
});

test('accepts explicit protection duration', () => {
  const plan = buildPvpSettlementPlan(input({ protectionSeconds: 7200 }));
  assert.equal(plan.userPlans[1].protectionUntil, 8200);
});
