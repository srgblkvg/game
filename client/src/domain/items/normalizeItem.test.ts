/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeItem } from './normalizeItem.ts';

test('normalizes snake and camel rarity/upgrade fields', () => {
  const item = normalizeItem({
    id: 11,
    name: 'Руна Сапфира',
    rarityId: '3',
    upgradelevel: '7',
    type: 'craft_item',
  });

  assert.equal(item.rarity_id, 3);
  assert.equal(item.upgradeLevel, 7);
  assert.equal(item.count, 1);
});

test('normalizes missing or zero stack count to one', () => {
  assert.equal(normalizeItem({ id: 1, name: 'Руна', count: 0 }).count, 1);
  assert.equal(normalizeItem({ id: 1, name: 'Руна', count: '4' }).count, 4);
});

test('parses JSON bonuses and extra without mutating input', () => {
  const source = { id: 5, name: 'Меч', bonuses: '{"s":5}', extra: '{"crit":2}' };
  const item = normalizeItem(source);
  assert.deepEqual(item.bonuses, { s: 5 });
  assert.deepEqual(item.extra, { crit: 2 });
  assert.equal(typeof source.bonuses, 'string');
});
