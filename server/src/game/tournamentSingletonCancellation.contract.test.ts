/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(__dirname, '../routes/tournament.ts'), 'utf8');
const txStart = source.indexOf('export async function mergeExpiredOfficialQueuesTx');
const txEnd = source.indexOf('export async function autoAdvance', txStart);
const txSource = source.slice(txStart, txEnd);
const wrapperStart = source.indexOf('export async function mergeExpiredOfficialQueues()');
const wrapperEnd = source.indexOf('export async function rebalanceOfficialQueuePools', wrapperStart);
const wrapperSource = source.slice(wrapperStart, wrapperEnd);

test('singleton divisions are cancelled without creating or carrying a waiting queue', () => {
  assert.doesNotMatch(txSource, /waitingQueue|waitingTournamentId|registrationStart = now \+ OFFICIAL_INTERVAL/);
  assert.match(txSource, /const cancelledUserIds = split\.singletons\.map/);
  assert.match(txSource, /const treasuryRefund = allocation\.refund/);
  assert.doesNotMatch(txSource, /allocation\.refund - carriedReserve/);
});

test('singleton cancellation notifications are emitted only after transaction commit', () => {
  assert.match(wrapperSource, /const result = await db\.tx\(mergeExpiredOfficialQueuesTx\)/);
  assert.match(wrapperSource, /for \(const userId of result\.cancelledUserIds\)[\s\S]*pushNotification\(userId/);
  assert.ok(wrapperSource.indexOf('await db.tx') < wrapperSource.indexOf('pushNotification'));
  assert.match(wrapperSource, /Противника подобрать не удалось\. Турнир по вашему дивизиону не собрался и отменён\./);
  assert.doesNotMatch(txSource, /pushNotification|sendToUser/);
});

test('public merge API preserves created tournament id return shape', () => {
  assert.match(wrapperSource, /return result\.createdIds/);
});
