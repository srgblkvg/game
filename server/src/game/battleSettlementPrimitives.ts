import type { PoolClient } from 'pg';

export const STAT_POINTS_PER_LEVEL = 5;

export interface ApplyExpWithClientResult {
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

function expForLevel(level: number): number {
  return 10 * Math.pow(2, level - 1);
}

/**
 * Calculates experience settlement using the caller's transaction client.
 * Achievement progress is deliberately left to the post-commit caller.
 */
export async function applyExpWithClient(
  client: PoolClient,
  userId: number,
  expGain: number,
  currentExp: number,
  currentLevel: number,
  currentStatPoints: number,
): Promise<ApplyExpWithClientResult> {
  const setting = (await client.query(
    'SELECT expenabled FROM users WHERE id = $1',
    [userId],
  )).rows[0] as { expenabled?: boolean } | undefined;
  if (setting?.expenabled === false) expGain = 0;

  let exp = currentExp + expGain;
  let level = currentLevel;
  let levelsGained = 0;
  while (exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level += 1;
    levelsGained += 1;
  }

  return {
    newExp: exp,
    newLevel: level,
    levelsGained,
    newStatPoints: currentStatPoints + levelsGained * STAT_POINTS_PER_LEVEL,
  };
}

/**
 * Collects guild tax using only the supplied transaction client.
 * Quest progress is deliberately left to the post-commit caller.
 */
export async function collectGuildTaxWithClient(
  client: PoolClient,
  userId: number,
  income: number,
  source: string,
): Promise<GuildTaxResult> {
  if (income <= 0) {
    return { netIncome: income, guildId: null, tax: 0 };
  }

  const member = (await client.query(
    'SELECT gm.guildid, g.taxrate FROM guild_members gm JOIN guilds g ON gm.guildid = g.id WHERE gm.userid = $1 FOR UPDATE OF g',
    [userId],
  )).rows[0] as { guildid?: number; taxrate?: number } | undefined;
  const guildId = member?.guildid === undefined ? null : Number(member.guildid);
  const taxRate = Number(member?.taxrate || 0);
  if (guildId === null || !taxRate || taxRate <= 0) {
    return { netIncome: income, guildId, tax: 0 };
  }

  const tax = Math.max(1, Math.floor(income * taxRate / 100));
  if (tax <= 0) return { netIncome: income, guildId, tax: 0 };

  await client.query(
    'UPDATE guilds SET treasury = treasury + $1 WHERE id = $2',
    [tax, guildId],
  );
  await client.query(
    'INSERT INTO guild_treasury_log (guildid, userid, amount, type, createdat) VALUES ($1, $2, $3, $4, $5)',
    [guildId, userId, tax, source, new Date().toISOString()],
  );

  return { netIncome: income - tax, guildId, tax };
}

// Battle route integration is intentionally not done in this bounded seam.
// Global helper behavior remains unchanged.
