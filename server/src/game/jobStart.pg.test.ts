/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { startJob } from './jobStart';
import { createPgJobStartRepository } from './jobStartRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

pgTest('два параллельных PG старта создают одну activejob', async () => {
  let userId: number | null = null;
  let jobId: number | null = null;
  try {
    userId = Number((await pool.query(
      `INSERT INTO users (username, passwordhash, level, faction, premiumuntil, activejob)
       VALUES ($1, $2, 2, NULL, 0, NULL) RETURNING id`,
      [`job-start-${Date.now()}`, 'test'],
    )).rows[0].id);
    jobId = Number((await pool.query(
      `INSERT INTO jobs (name, description, duration, rewardmin, rewardmax, background)
       VALUES ('PG работа', '', 3600, 10, 20, NULL) RETURNING id`,
    )).rows[0].id);

    const input = { userId, jobId, now: 1000, random: () => 0 };
    const results = await Promise.all([
      startJob(createPgJobStartRepository(), input),
      startJob(createPgJobStartRepository(), input),
    ]);
    assert.equal(results.filter(result => result.started).length, 1);
    assert.deepEqual(results.find(result => !result.started), { started: false, reason: 'already-active' });

    const row = (await pool.query('SELECT activejob FROM users WHERE id = $1', [userId])).rows[0];
    const active = typeof row.activejob === 'string' ? JSON.parse(row.activejob) : row.activejob;
    assert.equal(active.jobId, jobId);
    assert.equal(active.rewardMin, 10);
    assert.equal(active.rewardMax, 40);
  } finally {
    if (userId !== null) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    if (jobId !== null) await pool.query('DELETE FROM jobs WHERE id = $1', [jobId]);
  }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
