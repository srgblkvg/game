/// <reference types="node" />
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';

const routePath = path.resolve(__dirname, '../routes/character.ts');
const clientApiPath = path.resolve(__dirname, '../../../client/src/api/character.ts');

function routeSource() {
  return readFileSync(routePath, 'utf8');
}

test('character API не принимает полную клиентскую копию персонажа', () => {
  const source = routeSource();
  assert.doesNotMatch(source, /router\.post\(['"]\/character\/save['"]/);
  assert.doesNotMatch(readFileSync(clientApiPath, 'utf8'), /export async function saveCharacter/);
});

test('GET character\/me обогащает ответ без записи ownership JSON', () => {
  const source = routeSource();
  const start = source.indexOf("router.get('/character/me'");
  const end = source.indexOf("router.post('/character/save-tabs'", start);
  assert.ok(start >= 0 && end > start, 'не найден диапазон character/me');
  const handler = source.slice(start, end);
  assert.doesNotMatch(handler, /UPDATE users SET inventory/i);
  assert.doesNotMatch(handler, /UPDATE users SET equipment/i);
  assert.match(handler, /inventory, equipment: enrichedEquipment/);
});
