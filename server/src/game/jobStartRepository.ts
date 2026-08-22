import type { PoolClient } from 'pg';
import { db } from '../db/index';
import type { JobCatalogEntry, JobStartRepository, JobStartTransaction } from './jobStart';

function catalog(row: any): JobCatalogEntry {
  return {
    id: Number(row.id),
    name: String(row.name),
    duration: Number(row.duration),
    rewardMin: Number(row.rewardmin || 0),
    rewardMax: Number(row.rewardmax || 0),
    background: row.background || null,
  };
}

function adapter(client: PoolClient): JobStartTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query(
        `SELECT id, level, faction, premiumuntil, activejob
         FROM users WHERE id = $1 FOR UPDATE`,
        [userId],
      )).rows[0];
      return row ? {
        id: Number(row.id),
        level: Number(row.level || 1),
        faction: row.faction || null,
        premiumUntil: Number(row.premiumuntil || 0),
        activeJob: row.activejob || null,
      } : null;
    },
    async findJob(jobId) {
      const row = (await client.query(
        `SELECT id, name, duration, rewardmin, rewardmax, background
         FROM jobs WHERE id = $1`,
        [jobId],
      )).rows[0];
      return row ? catalog(row) : null;
    },
    async findJobsByDuration(duration) {
      const rows = (await client.query(
        `SELECT id, name, duration, rewardmin, rewardmax, background
         FROM jobs WHERE duration = $1 ORDER BY id`,
        [duration],
      )).rows;
      return rows.map(catalog);
    },
    async saveActiveJob(userId, activeJob) {
      await client.query('UPDATE users SET activejob = $1 WHERE id = $2', [JSON.stringify(activeJob), userId]);
    },
  };
}

export function createPgJobStartRepository(): JobStartRepository {
  return {
    transaction(callback) {
      return db.tx(client => callback(adapter(client)));
    },
  };
}
