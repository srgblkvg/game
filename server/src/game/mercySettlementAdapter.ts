import { buildPvpSettlementPlan, type PvpPlanInput } from './pvpSettlementPlan';
import type { PvpSettlementV2Input, PvpSettlementV2Result } from './pvpSettlementV2';

/** Values calculated by the mercy route before settlement locks either user. */
export type MercySettlementAdapterInput = {
  attackerId: number;
  defenderId: number;
  expGained: number;
  attackerEloDelta: number;
  defenderEloDelta: number;
  attackerHpAfter: number;
  defenderHpAfter: number;
  historyLog: unknown;
  log: unknown;
  steps: (actualMoneyStolen: number) => unknown[];
  plannedMoneyStolen: number;
  now: number;
  protectionSeconds?: number;
  persistHp?: boolean;
  karmaDelta?: number;
  banditReputationDelta?: number;
};

export type MercyResponseMetadata = {
  static: {
    mercy: true;
    winnerId: number;
    hpAfter: number;
    hpDefenderAfter: number;
    expGained: number;
    log: unknown;
  };
  /** Build monetary mercy steps only after the locked transfer is known. */
  steps: (actualMoneyStolen: number) => unknown[];
  /** Settlement is the only layer allowed to determine the level change. */
  levelsGained: (settlement: PvpSettlementV2Result) => number;
};

export type MercySettlementAdapterResult = {
  plan: PvpSettlementV2Input;
  responseMetadata: MercyResponseMetadata;
};

export function buildMercySettlementAdapter(input: MercySettlementAdapterInput): MercySettlementAdapterResult {
  const planInput: PvpPlanInput = {
    kind: 'mercy',
    attackerId: input.attackerId,
    defenderId: input.defenderId,
    winnerId: input.attackerId,
    plannedMoneyStolen: input.plannedMoneyStolen,
    expGained: input.expGained,
    attackerEloDelta: input.attackerEloDelta,
    defenderEloDelta: input.defenderEloDelta,
    attackerHpAfter: input.attackerHpAfter,
    defenderHpAfter: input.defenderHpAfter,
    now: input.now,
    attackerLog: input.historyLog,
    battleSteps: (actualMoneyStolen: number) => input.steps(actualMoneyStolen),
    ...(input.protectionSeconds !== undefined ? { protectionSeconds: input.protectionSeconds } : {}),
    persistHp: false,
    ...(input.karmaDelta !== undefined ? { karmaDelta: input.karmaDelta } : {}),
    ...(input.banditReputationDelta !== undefined ? { banditReputationDelta: input.banditReputationDelta } : {}),
  };

  return {
    plan: buildPvpSettlementPlan(planInput),
    responseMetadata: {
      static: {
        mercy: true,
        winnerId: input.attackerId,
        hpAfter: input.attackerHpAfter,
        hpDefenderAfter: input.defenderHpAfter,
        expGained: input.expGained,
        log: input.log,
      },
      steps: actualMoneyStolen => input.steps(actualMoneyStolen),
      levelsGained: settlement => settlement.users[input.attackerId]?.levelsGained ?? 0,
    },
  };
}


