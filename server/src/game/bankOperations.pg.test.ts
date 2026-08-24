/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { depositWithClient, transferWithClient } from './bankOperations';

const enabled = process.env.RUN_PG_TESTS === '1' && process.env.PGDATABASE === 'game_dev';
const pgTest = enabled ? test : test.skip;

pgTest('bank deposit and transfer commit domain state with treasury audit and fully roll back', async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const suffix = `${Date.now()}-${Math.random()}`;
    const senderAccount = `S${Date.now()}`;
    const targetAccount = `T${Date.now()}`;
    const sender = (await client.query(
      `INSERT INTO users (username, passwordhash, money, bank, accountnumber)
       VALUES ($1, 'test', 5000, 5000, $2) RETURNING id`,
      [`bank-atomic-sender-${suffix}`, senderAccount],
    )).rows[0];
    const target = (await client.query(
      `INSERT INTO users (username, passwordhash, money, bank, accountnumber)
       VALUES ($1, 'test', 0, 100, $2) RETURNING id`,
      [`bank-atomic-target-${suffix}`, targetAccount],
    )).rows[0];
    const beforeTreasury = Number((await client.query(
      'SELECT amount FROM castle_treasury WHERE id = 1',
    )).rows[0].amount);
    const beforeLogs = Number((await client.query(
      "SELECT COUNT(*) FROM treasury_log WHERE source IN ('bank_deposit', 'bank_transfer')",
    )).rows[0].count);

    const deposit = await depositWithClient(client, Number(sender.id), 1000);
    const transfer = await transferWithClient(client, Number(sender.id), targetAccount, 1000);

    assert.deepEqual(deposit, { money: 4000, bank: 5980, commission: 20, deposited: 980 });
    assert.equal(transfer.bank, 4980);
    assert.equal(transfer.targetUsername, `bank-atomic-target-${suffix}`);
    assert.equal(transfer.commission, 20);
    assert.equal(transfer.receivedAmount, 980);
    const inside = await client.query(
      `SELECT
         (SELECT amount FROM castle_treasury WHERE id = 1) AS treasury,
         (SELECT bank FROM users WHERE id = $1) AS sender_bank,
         (SELECT bank FROM users WHERE id = $2) AS target_bank,
         (SELECT COUNT(*) FROM treasury_log WHERE source IN ('bank_deposit', 'bank_transfer')) AS logs,
         (SELECT COUNT(*) FROM bank_operations WHERE userid = $1 AND type = 'deposit') AS deposits,
         (SELECT COUNT(*) FROM transfers WHERE fromuserid = $1 AND touserid = $2) AS transfers`,
      [sender.id, target.id],
    );
    assert.deepEqual(
      {
        treasury: Number(inside.rows[0].treasury),
        senderBank: Number(inside.rows[0].sender_bank),
        targetBank: Number(inside.rows[0].target_bank),
        logs: Number(inside.rows[0].logs),
        deposits: Number(inside.rows[0].deposits),
        transfers: Number(inside.rows[0].transfers),
      },
      {
        treasury: beforeTreasury + 40,
        senderBank: 4980,
        targetBank: 1080,
        logs: beforeLogs + 2,
        deposits: 1,
        transfers: 1,
      },
    );

    await client.query('ROLLBACK');
    const cleanup = await pool.query(
      'SELECT COUNT(*) FROM users WHERE username IN ($1, $2)',
      [`bank-atomic-sender-${suffix}`, `bank-atomic-target-${suffix}`],
    );
    assert.equal(Number(cleanup.rows[0].count), 0);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

test.after(async () => { if (enabled) await pool.end(); });
