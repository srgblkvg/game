/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';

const runPg = process.env.RUN_PG_TESTS === '1' ? test : test.skip;
const NS = 932001;

async function fixture() {
  const username = `__tournament_lifecycle_${Date.now()}_${Math.random()}`;
  const user = await pool.query(
    `INSERT INTO users (username, passwordhash, level, money, createdat)
     VALUES ($1, 'x', 1, 1000, NOW()) RETURNING id`,
    [username],
  );
  const tournament = await pool.query(
    `INSERT INTO tournaments
     (division, status, registrationstart, registrationend, prizepool, basepool, createdat, type, maxplayers, name)
     VALUES ('official-cycle', 'registration', $1, $2, 1000, 1000, NOW(), 'official', 1000000, 'lifecycle-test')
     RETURNING id`,
    [Math.floor(Date.now() / 1000) - 10, Math.floor(Date.now() / 1000) + 600],
  );
  return { userId: Number(user.rows[0].id), tournamentId: Number(tournament.rows[0].id) };
}

async function cleanup(userId: number, tournamentId: number) {
  await pool.query('DELETE FROM tournament_matches WHERE tournamentid = $1', [tournamentId]);
  await pool.query('DELETE FROM tournament_participants WHERE tournamentid = $1', [tournamentId]);
  await pool.query('DELETE FROM tournaments WHERE id = $1', [tournamentId]);
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

runPg('registration и delete сериализуются без dangling participant', async () => {
  const { userId, tournamentId } = await fixture();
  const registration = await pool.connect();
  const deletion = await pool.connect();
  try {
    await registration.query('BEGIN');
    await registration.query('SELECT pg_advisory_xact_lock($1, $2)', [NS, userId]);
    const waitingDelete = (async () => {
      await deletion.query('BEGIN');
      await deletion.query('SELECT pg_advisory_xact_lock($1, $2)', [NS, userId]);
      const active = (await deletion.query(
        `SELECT 1 FROM tournament_participants tp JOIN tournaments t ON t.id = tp.tournamentid
         WHERE tp.userid = $1 AND t.status IN ('registration', 'in_progress')`, [userId],
      )).rows[0];
      await deletion.query('ROLLBACK');
      return Boolean(active);
    })();
    await registration.query(
      `INSERT INTO tournament_participants (tournamentid, userid, snapshotstats)
       VALUES ($1, $2, $3)`, [tournamentId, userId, '{}'],
    );
    await registration.query('COMMIT');
    assert.equal(await waitingDelete, true);
    const state = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM users WHERE id=$1) alive,
              EXISTS(SELECT 1 FROM tournament_participants WHERE tournamentid=$2 AND userid=$1) registered`,
      [userId, tournamentId],
    );
    assert.deepEqual(state.rows[0], { alive: true, registered: true });
  } finally {
    await registration.query('ROLLBACK').catch(() => {});
    await deletion.query('ROLLBACK').catch(() => {});
    registration.release(); deletion.release();
    await cleanup(userId, tournamentId);
  }
});

runPg('delete первым не позволяет регистрации создать orphan participant', async () => {
  const { userId, tournamentId } = await fixture();
  const deletion = await pool.connect();
  const registration = await pool.connect();
  try {
    await deletion.query('BEGIN');
    await deletion.query('SELECT pg_advisory_xact_lock($1, $2)', [NS, userId]);
    const waitingRegistration = (async () => {
      await registration.query('BEGIN');
      await registration.query('SELECT pg_advisory_xact_lock($1, $2)', [NS, userId]);
      const user = (await registration.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])).rows[0];
      await registration.query('ROLLBACK');
      return Boolean(user);
    })();
    await deletion.query('DELETE FROM users WHERE id=$1', [userId]);
    await deletion.query('COMMIT');
    assert.equal(await waitingRegistration, false);
    const participants = await pool.query(
      'SELECT COUNT(*)::int count FROM tournament_participants WHERE tournamentid=$1 AND userid=$2',
      [tournamentId, userId],
    );
    assert.equal(participants.rows[0].count, 0);
  } finally {
    await deletion.query('ROLLBACK').catch(() => {});
    await registration.query('ROLLBACK').catch(() => {});
    deletion.release(); registration.release();
    await cleanup(userId, tournamentId);
  }
});
