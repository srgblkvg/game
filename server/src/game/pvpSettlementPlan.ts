import type { PvpSettlementV2Input, UserSettlementDelta } from './pvpSettlementV2';

export type PvpPlanInput = {
  kind: 'mercy' | 'regular';
  attackerId: number;
  defenderId: number;
  winnerId: number;
  plannedMoneyStolen: number;
  expGained: number;
  attackerEloDelta: number;
  defenderEloDelta: number;
  attackerHpAfter: number;
  defenderHpAfter: number;
  now: number;
  protectionSeconds?: number;
  attackerLog: unknown;
  battleSteps: unknown;
  persistHp?: boolean;
  karmaDelta?: number;
  banditReputationDelta?: number;
};

function userPlan(input: PvpPlanInput, userId: number, winner: boolean): { userId: number } & UserSettlementDelta {
  const money = input.plannedMoneyStolen;
  return {
    userId,
    moneyDelta: winner ? money : -money,
    battlesDelta: 1,
    winsDelta: winner ? 1 : 0,
    seasonWinsDelta: winner ? 1 : 0,
    seasonLossesDelta: winner ? 0 : 1,
    pvpMoneyWonDelta: winner ? money : 0,
    pvpMoneyLostDelta: winner ? 0 : money,
    expGain: winner ? input.expGained : 0,
    eloDelta: userId === input.attackerId ? input.attackerEloDelta : input.defenderEloDelta,
    hpAfter: userId === input.attackerId ? input.attackerHpAfter : input.defenderHpAfter,
    ...(userId === input.attackerId
      ? { lastAttackTime: input.now, lastHpUpdate: input.now, lastPvpTime: input.now, arenaOpponentId: null }
      : { protectionUntil: input.now + (input.protectionSeconds ?? 3600), ...(input.kind === 'regular' ? { lastHpUpdate: input.now } : {}), lastPvpTime: input.now }),
    ...(input.persistHp === false ? { persistHp: false } : {}),
    ...(winner && input.karmaDelta !== undefined ? { karmaDelta: input.karmaDelta } : {}),
    ...(winner && input.banditReputationDelta !== undefined ? { banditReputationDelta: input.banditReputationDelta } : {}),
  };
}

export function buildPvpSettlementPlan(input: PvpPlanInput): PvpSettlementV2Input {
  const loserId = input.winnerId === input.attackerId ? input.defenderId : input.attackerId;
  const winnerPlan = userPlan(input, input.winnerId, true);
  const loserPlan = userPlan(input, loserId, false);
  const amount = input.plannedMoneyStolen;
  return {
    outcome: {
      kind: input.kind,
      attackerId: input.attackerId,
      defenderId: input.defenderId,
      winnerId: input.winnerId,
      loserId,
    },
    userPlans: input.winnerId === input.attackerId
      ? [winnerPlan, loserPlan]
      : [loserPlan, winnerPlan],
    taxPlan: amount > 0 ? { recipientId: input.winnerId, grossIncome: amount, source: 'tax_pvp' } : null,
    history: {
      attackerId: input.attackerId,
      defenderId: input.defenderId,
      winnerId: input.winnerId,
      log: input.attackerLog,
      steps: input.battleSteps,
      attackerHpAfter: input.attackerHpAfter,
      defenderHpAfter: input.defenderHpAfter,
      expGained: input.expGained,
      moneyGained: amount,
      moneyStolen: amount,
    },
  };
}
