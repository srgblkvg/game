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
  recipient: LockedPvpUser,
  income: number,
  source: 'tax_pvp',
): Promise<GuildTaxResult> {
  if (income <= 0) return { netIncome: income, guildId: null, tax: 0 };
  if (recipient.guildid === null) return { netIncome: income, guildId: null, tax: 0 };
  const membership = await client.query('SELECT guildid FROM guild_members WHERE userid = $1 FOR UPDATE', [recipient.id]);
  if (membership.rowCount === 0) throw new Error('PvP locked guild membership is missing');
  if (membership.rowCount !== 1 || Number(membership.rows[0].guildid) !== recipient.guildid) {
    throw new Error('PvP locked guild membership does not match user snapshot');
  }
  const guild = await client.query('SELECT id, taxrate FROM guilds WHERE id = $1 FOR UPDATE', [recipient.guildid]);
  if (guild.rowCount !== 1) throw new Error('PvP locked guild disappeared before tax settlement');
  const guildId = Number(guild.rows[0].id);
  const taxRate = Number(guild.rows[0].taxrate || 0);
  if (taxRate <= 0) return { netIncome: income, guildId, tax: 0 };
  const tax = Math.max(1, Math.floor(income * taxRate / 100));
  const treasury = await client.query('UPDATE guilds SET treasury = treasury + $1 WHERE id = $2', [tax, guildId]);
  if (treasury.rowCount !== 1) throw new Error('PvP guild treasury update failed');
  const log = await client.query(
    'INSERT INTO guild_treasury_log (guildid, userid, amount, type, createdat) VALUES ($1, $2, $3, $4, $5)',
    [guildId, recipient.id, tax, source, new Date().toISOString()],
  );
  if (log.rowCount !== 1) throw new Error('PvP guild tax log insert failed');
  return { netIncome: income - tax, guildId, tax };
}

// Post-commit achievements and guild quest effects remain outside this module.
