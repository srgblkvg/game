/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const source = readFileSync(resolve(import.meta.dirname, 'TrainingPage.tsx'), 'utf8');

test('training page delegates loading state to DataState without changing training behavior', () => {
  assert.match(source, /import DataState from '\.\.\/components\/ui\/DataState';/);
  assert.match(source, /<DataState[\s\S]*isLoading={!loaded}[\s\S]*isEmpty={false}/);
  assert.match(source, /loading={[\s\S]*<PageHeader title="Лудус" icon={icon} bgImage={bgImage} \/>[\s\S]*Загрузка\.\.\.[\s\S]*}/);
  assert.match(source, /fetch\('\/api\/training', \{ headers: getHeaders\(\) \}\)/);
  assert.match(source, /fetch\('\/api\/training', \{[\s\S]*method: 'POST'/);
  assert.match(source, /setInterval\(\(\) =>/);
  assert.match(source, /formatClockCountdown\(cooldownSec\)/);
  assert.match(source, /Тренируйте базовые статы\. Одна тренировка в час\./);
});
