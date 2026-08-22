/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const app = () => readFileSync(resolve(process.cwd(), '../client/src/App.tsx'), 'utf8');
const overlay = () => readFileSync(resolve(process.cwd(), '../client/src/components/TutorialOverlay.tsx'), 'utf8');

test('App сохраняет канонический пассивный TutorialOverlay и имеет отдельные complete/skip handlers', () => {
  const source = app();
  assert.match(source, /<TutorialOverlay/);
  assert.match(source, /onComplete=\{handleTutorialComplete\}/);
  assert.match(source, /onSkip=\{handleTutorialSkip\}/);
  assert.doesNotMatch(source, /<TutorialFlow/);
});

test('completion и skip закрывают overlay только после успешного ответа', () => {
  const source = app();
  assert.match(source, /\/character\/tutorial-done/);
  assert.match(source, /\/tutorial\/skip/);
  assert.match(source, /if \(!res\.ok\) return/);
});

test('Escape и кнопка пропуска используют onSkip, последний экран использует onComplete', () => {
  const source = overlay();
  assert.match(source, /const handleSkip = \(\) => \{ onSkip\(\); \}/);
  assert.match(source, /if \(isLast\) \{\s*onComplete\(\)/);
  assert.match(source, /e\.key === 'Escape'\) handleSkip\(\)/);
});
