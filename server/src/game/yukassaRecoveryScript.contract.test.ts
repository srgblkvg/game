/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const body = readFileSync(resolve(__dirname, '../scripts/processYukassaPayments.ts'), 'utf8');

test('YooKassa recovery script is read-only and cannot bypass atomic delivery', () => {
  assert.match(body, /SELECT[\s\S]*FROM yukassa_payments[\s\S]*status = 'pending'/);
  assert.match(body, /read-only/i);
  assert.doesNotMatch(body, /UPDATE\s+users|UPDATE\s+yukassa_payments|INSERT\s+INTO|DELETE\s+FROM/i);
  assert.doesNotMatch(body, /premiumUntil|deliver[A-Z]|processYooKassa[A-Z]/);
});
