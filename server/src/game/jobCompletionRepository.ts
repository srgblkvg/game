import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type {
  JobCompletionRepository,
  JobCompletionTransaction,
  LockedJobUser,
} from './jobCompletion';

function numberOrZero(value: unknown): number {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function adapter(client: PoolClient): JobCompletionTransaction {
  return {
    async lockUser(userId): Promise<LockedJobUser | null> {
      const row = (await client.query(
        `SELECT id, activejob, money, exp, level, statpoints, expenabled,
                totaljobmoney, totaljobseconds, oauthprovider, oauthid
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        activeJob: row.activejob,
        money: numberOrZero(row.money),
        exp: numberOrZero(row.exp),
        level: Math.max(1, numberOrZero(row.level)),
        statPoints: numberOrZero(row.statpoints),
        expEnabled: row.expenabled !== false,
        totalJobMoney: numberOrZero(row.totaljobmoney),
        totalJobSeconds: numberOrZero(row.totaljobseconds),
        oauthProvider: row.oauthprovider ?? null,
        oauthId: row.oauthid ?? null,
      };
    },
    async lockGuildForTax(userId) {
      // Lock order is users -> membership -> guild; never acquire these in reverse.
      const membership = (await client.query(
        `SELECT guildid FROM guild_members
         WHERE userid = $1
         ORDER BY guildid
         LIMIT 1
         FOR UPDATE`,
        [userId],
      )).rows[0];
      if (!membership) return null;
      const guild = (await client.query(
        'SELECT id, taxrate FROM guilds WHERE id = $1 FOR UPDATE',
        [membership.guildid],
      )).rows[0];
      return guild ? { guildId: Number(guild.id), taxRate: numberOrZero(guild.taxrate) } : null;
    },
    async addGuildTax(entry) {
      await client.query(
        'UPDATE guilds SET treasury = treasury + $1 WHERE id = $2',
        [entry.amount, entry.guildId],
      );
      await client.query(
        `INSERT INTO guild_treasury_log (guildid, userid, amount, type, createdat)
         VALUES ($1, $2, $3, $4, $5)`,
        [entry.guildId, entry.userId, entry.amount, entry.source, entry.createdAt],
      );
    },
    async saveCompletedUser(settlement) {
      await client.query(
        `UPDATE users
         SET money = $1, exp = $2, level = $3, statpoints = $4, activejob = NULL,
             totaljobmoney = $5, totaljobseconds = $6
         WHERE id = $7`,
        [
          settlement.money,
          settlement.exp,
          settlement.level,
          settlement.statPoints,
          settlement.totalJobMoney,
          settlement.totalJobSeconds,
          settlement.userId,
        ],
      );
    },
    async addHistory(entry) {
      await client.query(
        `INSERT INTO job_history
         (userid, jobid, jobname, duration, reward, startedat, premiumbonus, xpgained)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.userId,
          entry.jobId,
          entry.jobName,
          entry.duration,
          entry.reward,
          entry.startedAt,
          entry.premiumBonus,
          entry.xpGained,
        ],
      );
    },
    async clearActiveJob(userId) {
      await client.query('UPDATE users SET activejob = NULL WHERE id = $1', [userId]);
    },
  };
}

export function createPgJobCompletionRepository(): JobCompletionRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
