/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = () => readFileSync(resolve(__dirname, '../routes/jobs.ts'), 'utf8');
const handler = (start: string, end: string) => {
  const body = source();
  const from = body.indexOf(start);
  const to = body.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `handler bounds missing: ${start}`);
  return body.slice(from, to);
};

test('/jobs/start делегирует transaction service без check-then-update', () => {
  const body = handler("router.post('/jobs/start'", "router.post('/jobs/start-random'");
  assert.match(body, /startJob\(/);
  assert.doesNotMatch(body, /SELECT \* FROM users|UPDATE users SET activeJob/i);
});

test('/jobs/start-random делегирует тот же transaction service', () => {
  const body = handler("router.post('/jobs/start-random'", "router.get('/jobs/history'");
  assert.match(body, /startJob\(/);
  assert.doesNotMatch(body, /SELECT \* FROM users|UPDATE users SET activeJob|startJobForUser/i);
});

test('legacy startJobForUser удалён', () => {
  assert.doesNotMatch(source(), /async function startJobForUser/);
});
