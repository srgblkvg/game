/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { completeJob, jobIdentity } from './jobCompletion';
import { createPgJobCompletionRepository } from './jobCompletionRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

pgTest('parallel completion claims one job and writes one payout, tax, history and totals', async () => {
  let userId: number | null = null;
  let guildId: number | null = null;
  const now = Math.floor(Date.now() / 1000);
  const job = {
    jobId: 91,
    name: 'Тестовая шахта',
    startTime: now - 120,
    endTime: now - 1,
    reward: 101,
    duration: 120,
    expReward: 15,
    premiumBonus: 4,
  };

  try {
    userId = Number((await pool.query(
      `INSERT INTO users
       (username, passwordhash, level, exp, money, statpoints, activejob, totaljobmoney, totaljobseconds)
       VALUES ($1, 'test', 1, 5, 500, 2, $2, 20, 30) RETURNING id`,
      [`job_completion_${Date.now()}_${Math.random()}`, JSON.stringify(job)],
    )).rows[0].id);
    guildId = Number((await pool.query(
      `INSERT INTO guilds (name, leaderid, treasury, taxrate)
       VALUES ($1, $2, 100, 10) RETURNING id`,
      [`job_completion_guild_${Date.now()}_${Math.random()}`, userId],
    )).rows[0].id);
    await pool.query('UPDATE users SET guildid=$1 WHERE id=$2', [guildId, userId]);
    await pool.query(
      `INSERT INTO guild_members (guildid, userid, rank) VALUES ($1, $2, 'leader')`,
      [guildId, userId],
    );

    const call = () => completeJob(createPgJobCompletionRepository(), {
      userId: userId!,
      now,
      mode: 'expired',
      expectedJobIdentity: jobIdentity(job),
    });
    const results = await Promise.all([call(), call()]);

    assert.equal(results.filter(result => result.completed).length, 1);
    assert.equal(results.filter(result => !result.completed && result.reason === 'no-active-job').length, 1);

    const userRow = (await pool.query(
      `SELECT money, exp, level, statpoints, activejob, totaljobmoney, totaljobseconds
       FROM users WHERE id=$1`,
      [userId],
    )).rows[0];
    assert.equal(Number(userRow.money), 591);
    assert.equal(Number(userRow.exp), 10);
    assert.equal(Number(userRow.level), 2);
    assert.equal(Number(userRow.statpoints), 7);
    assert.equal(userRow.activejob, null);
    assert.equal(Number(userRow.totaljobmoney), 121);
    assert.equal(Number(userRow.totaljobseconds), 150);

    const guildRow = (await pool.query('SELECT treasury FROM guilds WHERE id=$1', [guildId])).rows[0];
    assert.equal(Number(guildRow.treasury), 110);
    assert.equal(Number((await pool.query(
      `SELECT COUNT(*) AS count FROM guild_treasury_log
       WHERE guildid=$1 AND userid=$2 AND type='tax_job'`,
      [guildId, userId],
    )).rows[0].count), 1);
    assert.equal(Number((await pool.query(
      'SELECT COUNT(*) AS count FROM job_history WHERE userid=$1 AND jobid=$2',
      [userId, job.jobId],
    )).rows[0].count), 1);
  } finally {
    if (userId !== null) {
      await pool.query('DELETE FROM job_history WHERE userid=$1', [userId]);
      await pool.query('DELETE FROM guild_treasury_log WHERE userid=$1', [userId]);
      await pool.query('DELETE FROM guild_members WHERE userid=$1', [userId]);
    }
    if (guildId !== null) await pool.query('DELETE FROM guilds WHERE id=$1', [guildId]);
    if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
