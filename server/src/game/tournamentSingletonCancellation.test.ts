/// <reference types="node" />
/// <reference path="../types/express.d.ts" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeExpiredOfficialQueuesTx } from '../routes/tournament';

const snapshot = JSON.stringify({
  version: 1,
  combatPower: 1000,
  divisionIndex: 5,
  registeredAt: 1,
  player: {
    id: 77,
    name: 'Одинокий участник',
    level: 10,
    base: {},
    equipment: {},
    stats: { s: 10, a: 10, d: 10, m: 10, hp: 100, damage: 10, armor: 10 },
  },
});

test('single unmatched participant is cancelled, refunded and never carried forward', async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes('pg_try_advisory_xact_lock')) return { rows: [{ locked: true }] };
      if (sql.includes('SELECT id, registrationend FROM tournaments')) {
        return { rows: [{ id: 1414, registrationend: 1 }] };
      }
      if (sql.includes('SELECT id, division, name, COALESCE(basepool')) {
        return { rows: [{ id: 1414, division: 'official-cycle', name: 'Общий набор', basepool: 679002 }] };
      }
      if (sql.includes('SELECT tournamentid, userid, snapshotstats')) {
        return { rows: [{ tournamentid: 1414, userid: 77, snapshotstats: snapshot }] };
      }
      return { rows: [], rowCount: 1 };
    },
  };

  const result = await mergeExpiredOfficialQueuesTx(client);

  assert.deepEqual(result, { createdIds: [], cancelledUserIds: [77] });
  assert.equal(calls.filter(call => call.sql.includes('UPDATE castle_treasury')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes('INSERT INTO treasury_log')).length, 1);
  assert.deepEqual(
    calls.find(call => call.sql.includes('UPDATE castle_treasury'))?.params,
    [679002],
  );
  assert.equal(calls.filter(call => call.sql.includes('DELETE FROM tournament_participants')).length, 1);
  assert.equal(calls.filter(call => call.sql.includes("UPDATE tournaments SET status = 'cancelled'")).length, 1);
  assert.equal(calls.some(call => call.sql.includes("VALUES ('official-cycle', 'registration'")), false);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO tournament_participants')), false);
});
