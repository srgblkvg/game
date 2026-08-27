import type { PoolClient } from 'pg';
import { db } from '../db/index';
import {
  applyExpFromSnapshot,
  collectGuildTaxWithClient,
  lockPvpUsers,
  type ApplyExpResult,
  type GuildTaxResult,
  type LockedPvpUser,
} from './battleSettlementPrimitives';

export type PvpOutcome = {
  kind: 'mercy' | 'regular';
  attackerId: number;
  defenderId: number;
  winnerId: number;
  loserId: number;
};

export type UserSettlementDelta = {
  moneyDelta: number; battlesDelta: 1; winsDelta: 0 | 1; seasonWinsDelta: 0 | 1;
  seasonLossesDelta: 0 | 1; pvpMoneyWonDelta: number; pvpMoneyLostDelta: number;
  expGain: number; eloDelta: number; hpAfter?: number; lastAttackTime?: number;
  lastHpUpdate?: number; protectionUntil?: number; arenaOpponentId?: number | null;
  lastPvpTime?: number; persistHp?: boolean;
  karmaDelta?: number; banditReputationDelta?: number;
};

export type TaxPlan = { recipientId: number; grossIncome: number; source: 'tax_pvp' } | null;
export type PvpHistory = {
  attackerId: number; defenderId: number; winnerId: number; log: unknown; steps: unknown;
  attackerHpAfter: number; defenderHpAfter: number; expGained: number;
  moneyGained: number; moneyStolen: number;
};
export type PvpSettlementV2Input = {
  outcome: PvpOutcome;
  userPlans: [{ userId: number } & UserSettlementDelta, { userId: number } & UserSettlementDelta];
  taxPlan: TaxPlan;
  history: PvpHistory;
};
export type PvpSettlementV2Result = {
  users: Record<number, { money: number; exp: number; level: number; statpoints: number; elo: number }>;
  tax: GuildTaxResult;
  plannedMoneyStolen: number;
  actualMoneyStolen: number;
};

type QueryResult = { rowCount: number | null; rows: any[] };
type QueryClient = Pick<PoolClient, 'query'>;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function validate(input: PvpSettlementV2Input): void {
  const o = input.outcome;
  if (!['mercy', 'regular'].includes(o.kind)) throw new Error('Invalid PvP outcome kind');
  const ids = [o.attackerId, o.defenderId, o.winnerId, o.loserId];
  if (!ids.every(id => Number.isInteger(id) && id > 0) || o.attackerId === o.defenderId) throw new Error('Invalid PvP participant IDs');
  if (![o.attackerId, o.defenderId].includes(o.winnerId) || ![o.attackerId, o.defenderId].includes(o.loserId) || o.winnerId === o.loserId) throw new Error('Invalid PvP winner or loser');
  const participants = [o.attackerId, o.defenderId].sort((a, b) => a - b);
  const planIds = input.userPlans.map(p => p.userId).sort((a, b) => a - b);
  if (planIds[0] !== participants[0] || planIds[1] !== participants[1]) throw new Error('PvP user plans must match participants');
  for (const p of input.userPlans) {
    if (!finite(p.moneyDelta) || !finite(p.expGain) || p.expGain < 0 || !finite(p.eloDelta) || !finite(p.pvpMoneyWonDelta) || !finite(p.pvpMoneyLostDelta)) throw new Error('Invalid PvP delta');
  }
  if (input.taxPlan !== null) {
    if (input.taxPlan.recipientId !== o.winnerId) throw new Error('PvP tax recipient must be winner');
    if (!finite(input.taxPlan.grossIncome) || input.taxPlan.grossIncome < 0) throw new Error('Invalid PvP tax income');
    if (input.taxPlan.grossIncome === 0) throw new Error('Zero PvP income must not have a tax plan');
  }
  const h = input.history;
  if (h.attackerId !== o.attackerId || h.defenderId !== o.defenderId || h.winnerId !== o.winnerId) throw new Error('PvP history participants do not match outcome');
  if (![h.attackerId, h.defenderId].includes(h.winnerId) || !finite(h.moneyStolen) || h.moneyStolen < 0 || !finite(h.moneyGained) || h.moneyGained < 0 || !finite(h.expGained) || h.expGained < 0 || !finite(h.attackerHpAfter) || h.attackerHpAfter < 0 || !finite(h.defenderHpAfter) || h.defenderHpAfter < 0) throw new Error('Invalid PvP history');
  const winnerPlan = input.userPlans.find(p => p.userId === o.winnerId)!;
  const loserPlan = input.userPlans.find(p => p.userId === o.loserId)!;
  const grossIncome = input.taxPlan?.grossIncome ?? 0;
  if (grossIncome > 0 && input.taxPlan === null) throw new Error('Positive PvP income requires a tax plan');
  if (winnerPlan.moneyDelta !== grossIncome || loserPlan.moneyDelta !== -grossIncome) throw new Error('PvP money deltas must match gross income');
  if (winnerPlan.winsDelta !== 1 || winnerPlan.seasonWinsDelta !== 1 || winnerPlan.seasonLossesDelta !== 0 ||
      loserPlan.winsDelta !== 0 || loserPlan.seasonWinsDelta !== 0 || loserPlan.seasonLossesDelta !== 1) {
    throw new Error('PvP win/loss counters do not match outcome');
  }
  if (winnerPlan.pvpMoneyWonDelta !== grossIncome || winnerPlan.pvpMoneyLostDelta !== 0 ||
      loserPlan.pvpMoneyWonDelta !== 0 || loserPlan.pvpMoneyLostDelta !== grossIncome) {
    throw new Error('PvP money counters do not match outcome');
  }
  if (h.expGained !== winnerPlan.expGain || h.moneyStolen !== grossIncome || h.moneyGained !== grossIncome) throw new Error('PvP history income or XP invariant failed');
  const ap = input.userPlans.find(p => p.userId === o.attackerId)!;
  const dp = input.userPlans.find(p => p.userId === o.defenderId)!;
  if (h.attackerHpAfter !== ap.hpAfter || h.defenderHpAfter !== dp.hpAfter) throw new Error('PvP history HP invariant failed');
}

function expFor(user: LockedPvpUser, gain: number): ApplyExpResult { return applyExpFromSnapshot(user, gain); }

export async function settlePvpV2WithClient(client: QueryClient, input: PvpSettlementV2Input): Promise<PvpSettlementV2Result> {
  validate(input);
  const o = input.outcome;
  const locked = await lockPvpUsers(client as PoolClient, [o.attackerId, o.defenderId]);
  const byId = new Map(locked.map(u => [Number(u.id), u]));
  const winnerSnapshot = byId.get(o.winnerId);
  const loserSnapshot = byId.get(o.loserId);
  if (!winnerSnapshot || !loserSnapshot) throw new Error('PvP locked winner or loser missing');
  const plannedMoneyStolen = input.taxPlan?.grossIncome ?? 0;
  const actualMoneyStolen = Math.min(plannedMoneyStolen, Math.max(0, Number(loserSnapshot.money)));
  const tax = actualMoneyStolen === 0
    ? { netIncome: 0, guildId: null, tax: 0 }
    : await collectGuildTaxWithClient(client as PoolClient, winnerSnapshot, actualMoneyStolen, input.taxPlan!.source);
  const results: PvpSettlementV2Result['users'] = {};
  for (const p of input.userPlans) {
    const snapshot = byId.get(p.userId);
    if (!snapshot) throw new Error('PvP locked user missing');
    const xp = expFor(snapshot, p.expGain);
    const taxForUser = p.userId === o.winnerId ? tax.tax : 0;
    const plannedMoneyDelta = p.userId === o.winnerId ? plannedMoneyStolen : p.userId === o.loserId ? -plannedMoneyStolen : p.moneyDelta;
    const effectiveMoneyDelta = p.userId === o.loserId && plannedMoneyDelta < 0
      ? -Math.min(-plannedMoneyDelta, Math.max(0, Number(snapshot.money)))
      : p.userId === o.winnerId ? actualMoneyStolen : plannedMoneyDelta;
    const effectiveMoneyLost = p.userId === o.loserId ? -Math.min(0, effectiveMoneyDelta) : p.pvpMoneyLostDelta;
    const money = Math.max(0, Number(snapshot.money) + effectiveMoneyDelta - taxForUser);
    const sets = [
      `money = greatest(0, money + $1)`, `totalbattles = totalbattles + $2`, `wins = wins + $3`,
      `seasonwins = seasonwins + $4`, `seasonlosses = seasonlosses + $5`, `totalpvpmoneywon = totalpvpmoneywon + $6`,
      `totalpvpmoneylost = totalpvpmoneylost + $7`, `exp = $8`, `level = $9`, `statpoints = $10`,
      `elo = greatest(100, elo + $11)`,
    ];
    const moneyWon = p.userId === o.winnerId ? actualMoneyStolen : p.pvpMoneyWonDelta;
    const params: unknown[] = [effectiveMoneyDelta - taxForUser, p.battlesDelta, p.winsDelta, p.seasonWinsDelta, p.seasonLossesDelta, moneyWon, effectiveMoneyLost, xp.newExp, xp.newLevel, xp.newStatPoints, p.eloDelta];
    const absolute: Array<[string, unknown]> = [
      ...(p.persistHp === false ? [] : [['currenthp', p.hpAfter] as [string, unknown]]),
      ['lastattacktime', p.lastAttackTime], ['lasthpupdate', p.lastHpUpdate],
      ['lastpvptime', p.lastPvpTime], ['protectionuntil', p.protectionUntil], ['arenaopponentid', p.arenaOpponentId],
    ];
    for (const [column, value] of absolute) if (value !== undefined) { sets.push(`${column} = $${params.length + 1}`); params.push(value); }
    if (p.karmaDelta !== undefined) { sets.push(`karma = greatest(-100, least(100, karma + $${params.length + 1}))`); params.push(p.karmaDelta); }
    if (p.banditReputationDelta !== undefined) { sets.push(`bandit_reputation = bandit_reputation + $${params.length + 1}`); params.push(p.banditReputationDelta); }
    params.push(p.userId);
    const updated = await client.query(`update users set ${sets.join(', ')} where id = $${params.length}`, params) as QueryResult;
    if (updated.rowCount !== 1) throw new Error('PvP user update failed');
    results[p.userId] = { money, exp: xp.newExp, level: xp.newLevel, statpoints: xp.newStatPoints, elo: Math.max(100, Number(snapshot.elo) + p.eloDelta) };
  }
  const h = input.history;
  const historyResult = await client.query('insert into battles (attackerid, defenderid, winnerid, log, steps, attackerhpafter, defenderhpafter, expgained, moneygained, moneystolen) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [h.attackerId, h.defenderId, h.winnerId, JSON.stringify(h.log), JSON.stringify(h.steps), h.attackerHpAfter, h.defenderHpAfter, h.expGained, actualMoneyStolen, actualMoneyStolen]) as QueryResult;
  if (historyResult.rowCount !== 1) throw new Error('PvP history insert failed');
  return { users: results, tax, plannedMoneyStolen, actualMoneyStolen };
}

export async function settlePvpV2(input: PvpSettlementV2Input): Promise<PvpSettlementV2Result> {
  return db.tx(client => settlePvpV2WithClient(client, input));
}
