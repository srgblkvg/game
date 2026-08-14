import { db } from '../db/index';
import logger from '../logger';
import type { PoolClient } from 'pg';

const CHECK_INTERVAL_MS = 30_000;
const RESET_DAY_UTC = 5; // Friday
const RESET_LOCK_ID = 734_260_001;
const PLACE_REWARD_SQL = `CASE place WHEN 1 THEN 5 WHEN 2 THEN 3 WHEN 3 THEN 2 WHEN 4 THEN 1 WHEN 5 THEN 1 ELSE 0 END`;
let initPromise: Promise<void> | null = null;

export function getGuildBossWeekStart(now = new Date()): number {
  const midnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysSinceFriday = (now.getUTCDay() - RESET_DAY_UTC + 7) % 7;
  return Math.floor((midnightUtc - daysSinceFriday * 24 * 60 * 60 * 1000) / 1000);
}

export function getNextGuildBossResetAt(now = new Date()): number {
  return getGuildBossWeekStart(now) + 7 * 24 * 60 * 60;
}

async function initWeeklyResetState(): Promise<void> {
  if (!initPromise) {
    initPromise = db.raw(`
      CREATE TABLE IF NOT EXISTS guild_boss_weekly_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        week_start INTEGER NOT NULL
      )
    `).then(() => undefined).catch(error => {
      initPromise = null;
      throw error;
    });
  }
  await initPromise;
}

async function awardWeeklyRatingPoints(client: PoolClient): Promise<void> {
  // Личный рейтинг №1: урон внутри своей гильдии.
  await client.query(`
    WITH totals AS (
      SELECT guildid, userid, SUM(damagedealt) AS total
      FROM guild_boss_battles GROUP BY guildid, userid
    ), ranked AS (
      SELECT guildid, userid,
             ROW_NUMBER() OVER (PARTITION BY guildid ORDER BY total DESC, userid ASC) AS place
      FROM totals
    ), rewards AS (
      SELECT guildid, userid, ${PLACE_REWARD_SQL} AS points FROM ranked WHERE place <= 5
    )
    UPDATE guild_members gm
    SET talentpoints = COALESCE(gm.talentpoints, 0) + rewards.points
    FROM rewards
    WHERE gm.guildid = rewards.guildid AND gm.userid = rewards.userid
  `);

  // Личный рейтинг №2: общий урон среди всех игроков.
  await client.query(`
    WITH totals AS (
      SELECT guildid, userid, SUM(damagedealt) AS total
      FROM guild_boss_battles GROUP BY guildid, userid
    ), ranked AS (
      SELECT guildid, userid, ROW_NUMBER() OVER (ORDER BY total DESC, userid ASC) AS place
      FROM totals
    ), rewards AS (
      SELECT guildid, userid, ${PLACE_REWARD_SQL} AS points FROM ranked WHERE place <= 5
    )
    UPDATE guild_members gm
    SET talentpoints = COALESCE(gm.talentpoints, 0) + rewards.points
    FROM rewards
    WHERE gm.guildid = rewards.guildid AND gm.userid = rewards.userid
  `);

  // Личный рейтинг №3: сильнейший одиночный удар.
  await client.query(`
    WITH hits AS (
      SELECT b.guildid, b.userid,
             MAX(CASE WHEN step->>'type' = 'damage' THEN COALESCE((step->>'damage')::numeric, 0) ELSE 0 END) AS max_hit
      FROM guild_boss_battles b
      CROSS JOIN LATERAL jsonb_array_elements(b.steps::jsonb) AS step
      GROUP BY b.guildid, b.userid
    ), ranked AS (
      SELECT guildid, userid, ROW_NUMBER() OVER (ORDER BY max_hit DESC, userid ASC) AS place
      FROM hits WHERE max_hit > 0
    ), rewards AS (
      SELECT guildid, userid, ${PLACE_REWARD_SQL} AS points FROM ranked WHERE place <= 5
    )
    UPDATE guild_members gm
    SET talentpoints = COALESCE(gm.talentpoints, 0) + rewards.points
    FROM rewards
    WHERE gm.guildid = rewards.guildid AND gm.userid = rewards.userid
  `);

  // Гильдийский рейтинг №1: общий урон гильдии.
  await client.query(`
    WITH totals AS (
      SELECT guildid, SUM(damagedealt) AS total FROM guild_boss_battles GROUP BY guildid
    ), ranked AS (
      SELECT guildid, ROW_NUMBER() OVER (ORDER BY total DESC, guildid ASC) AS place FROM totals
    ), rewards AS (
      SELECT guildid, ${PLACE_REWARD_SQL} AS points FROM ranked WHERE place <= 5
    )
    UPDATE guilds g
    SET talentpoints = COALESCE(g.talentpoints, 0) + rewards.points
    FROM rewards WHERE g.id = rewards.guildid
  `);

  // Гильдийский рейтинг №2: количество побеждённых боссов.
  await client.query(`
    WITH ranked AS (
      SELECT guildid, ROW_NUMBER() OVER (ORDER BY killcount DESC, guildid ASC) AS place
      FROM guild_bosses WHERE killcount > 0
    ), rewards AS (
      SELECT guildid, ${PLACE_REWARD_SQL} AS points FROM ranked WHERE place <= 5
    )
    UPDATE guilds g
    SET talentpoints = COALESCE(g.talentpoints, 0) + rewards.points
    FROM rewards WHERE g.id = rewards.guildid
  `);
}

/**
 * Resets boss progression and ratings once per UTC week.
 * Talent points, talent levels and invested talent progress are untouched.
 */
export async function ensureGuildBossWeeklyReset(now = new Date()): Promise<boolean> {
  await initWeeklyResetState();
  const weekStart = getGuildBossWeekStart(now);

  return db.tx(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [RESET_LOCK_ID]);

    const state = await client.query(
      'SELECT week_start FROM guild_boss_weekly_state WHERE id = 1 FOR UPDATE'
    );

    // First deployment: establish the current week without erasing live progress.
    if (state.rowCount === 0) {
      await client.query(
        'INSERT INTO guild_boss_weekly_state (id, week_start) VALUES (1, $1)',
        [weekStart]
      );
      return false;
    }

    if (Number(state.rows[0].week_start) >= weekStart) return false;

    await awardWeeklyRatingPoints(client);
    await client.query('DELETE FROM guild_boss_battles');
    await client.query(`
      UPDATE guild_bosses
      SET killcount = 0,
          currenthp = 100000,
          maxhp = 100000,
          atk = 80,
          agi = 50,
          def = 60,
          mst = 50,
          level = 20,
          effects = '[]',
          respawnat = 0
    `);
    await client.query('UPDATE guild_members SET lastbossattackat = 0');
    await client.query(
      'UPDATE guild_boss_weekly_state SET week_start = $1 WHERE id = 1',
      [weekStart]
    );

    return true;
  });
}

async function checkWeeklyReset(): Promise<void> {
  try {
    if (await ensureGuildBossWeeklyReset()) {
      logger.info('[GuildBoss] Weekly progress and ratings reset at Friday 00:00 UTC');
    }
  } catch (error: any) {
    logger.error('[GuildBoss] Weekly reset failed:', error.message);
  }
}

export async function startGuildBossWeeklyResetScheduler(): Promise<void> {
  await initWeeklyResetState();
  await checkWeeklyReset();
  setInterval(() => { void checkWeeklyReset(); }, CHECK_INTERVAL_MS);
}
