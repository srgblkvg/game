import type { PoolClient } from 'pg';

export const STAT_POINTS_PER_LEVEL = 5;

export interface LockedPvpUser {
  id: number;
  money: number;
  exp: number;
  level: number;
  statpoints: number;
  expenabled: boolean;
  elo: number;
  guildid: number | null;
}

export interface ApplyExpResult {
  newExp: number;
  newLevel: number;
  levelsGained: number;
  newStatPoints: number;
}

export interface GuildTaxResult {
  netIncome: number;
  guildId: number | null;
  tax: number;
}

export function applyExpFromSnapshot(user: LockedPvpUser, expGain: number): ApplyExpResult {
  if (user.expenabled === false) expGain = 0;
  let exp = user.exp + expGain;
  let level = user.level;
  let levelsGained = 0;
  while (exp >= 10 * Math.pow(2, level - 1)) {
    exp -= 10 * Math.pow(2, level - 1);
    level += 1;
    levelsGained += 1;
  }
  return {
    newExp: exp,
    newLevel: level,
    levelsGained,
    newStatPoints: user.statpoints + levelsGained * STAT_POINTS_PER_LEVEL,
  };
}

export async function lockPvpUsers(client: PoolClient, ids: [number, number]): Promise<LockedPvpUser[]> {
  const sorted = [...ids].sort((a, b) => a - b);
  const result = await client.query(
    'SELECT id, money, exp, level, statpoints, expenabled, elo, guildid FROM users WHERE id = ANY($1::int[]) ORDER BY id ASC FOR UPDATE',
    [sorted],
  );
  const returnedIds = result.rows.map(row => Number(row.id)).sort((a, b) => a - b);
  if (result.rowCount !== 2 || returnedIds[0] !== sorted[0] || returnedIds[1] !== sorted[1]) {
    throw new Error('PvP users disappeared before settlement');
  }
  return result.rows as LockedPvpUser[];
}

export async function collectGuildTaxWithClient(
  client: PoolClient,
  userId: number,
  income: number,
  source: 'tax_pvp',
): Promise<GuildTaxResult> {
  if (income <= 0) return { netIncome: income, guildId: null, tax: 0 };
  const member = (await client.query(
    'SELECT gm.guildid, g.taxrate FROM guild_members gm JOIN guilds g ON gm.guildid = g.id WHERE gm.userid = $1 FOR UPDATE OF g',
    [userId],
  )).rows[0] as { guildid?: number; taxrate?: number } | undefined;
  const guildId = member?.guildid === undefined ? null : Number(member.guildid);
  const taxRate = Number(member?.taxrate || 0);
  if (guildId === null || taxRate <= 0) return { netIncome: income, guildId, tax: 0 };
  const tax = Math.max(1, Math.floor(income * taxRate / 100));
  const treasury = await client.query('UPDATE guilds SET treasury = treasury + $1 WHERE id = $2', [tax, guildId]);
  if (treasury.rowCount !== 1) throw new Error('PvP guild treasury update failed');
  const log = await client.query(
    'INSERT INTO guild_treasury_log (guildid, userid, amount, type, createdat) VALUES ($1, $2, $3, $4, $5)',
    [guildId, userId, tax, source, new Date().toISOString()],
  );
  if (log.rowCount !== 1) throw new Error('PvP guild tax log insert failed');
  return { netIncome: income - tax, guildId, tax };
}

// Post-commit achievements and guild quest effects remain outside this module.
