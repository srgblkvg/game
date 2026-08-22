/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function source(relativePath: string): string {
  return readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

function handler(file: string, startMarker: string, endMarker: string): string {
  const text = source(file);
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `handler range not found: ${startMarker}`);
  return text.slice(start, end);
}

test('GET /character/me is read-only for job settlement', () => {
  const body = handler('../routes/character.ts', "router.get('/character/me'", "router.post('/character/save-tabs'");
  assert.doesNotMatch(body, /collectGuildTax|applyExp|job_history|activeJob\s*=\s*NULL|totalJobMoney/i);
});

test('scheduler delegates expired settlement and contains no legacy payout SQL', () => {
  const body = source('../schedulers/jobs.ts');
  assert.match(body, /completeJob/);
  assert.match(body, /mode:\s*['"]expired['"]/);
  assert.match(body, /expectedJobIdentity:\s*jobIdentity\(/);
  assert.doesNotMatch(body, /collectGuildTax|applyExp|INSERT INTO job_history|UPDATE users SET money/i);
});

test('admin finish routes force settlement with the identity that was enumerated', () => {
  const body = source('../routes/adminJobs.ts');
  assert.match(body, /completeJob/);
  assert.match(body, /mode:\s*['"]force['"]/);
  assert.match(body, /expectedJobIdentity:\s*jobIdentity\(/);
  assert.doesNotMatch(body, /INSERT INTO job_history|UPDATE users SET money/i);
});

test('/jobs/cancel binds cancellation to the observed job identity', () => {
  const body = handler('../routes/jobs.ts', "router.post('/jobs/cancel'", '// Административные');
  assert.match(body, /cancelJob/);
  assert.match(body, /expectedJobIdentity:\s*jobIdentity\(/);
  assert.doesNotMatch(body, /UPDATE users SET activeJob = NULL/i);
});

test('post-commit effects preserve both job and tax guild quest progress', () => {
  const body = source('./jobCompletionEffects.ts');
  assert.match(body, /['"]jobs['"],\s*r\.job\.duration/);
  assert.match(body, /['"]donate['"],\s*r\.tax/);
});

test('cleanup expires job history by finishedAt, not the removed endTime column', () => {
  const body = source('../cleanup.ts');
  assert.match(body, /DELETE FROM job_history WHERE finishedAt < \?/i);
  assert.doesNotMatch(body, /DELETE FROM job_history WHERE endTime/i);
});
