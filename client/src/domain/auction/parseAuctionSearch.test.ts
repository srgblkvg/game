/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAuctionSearch } from './parseAuctionSearch.ts';

test('extracts stat and slot keywords while preserving unknown text', () => {
  assert.deepEqual(parseAuctionSearch('крит перчатки Древний сет'), {
    text: 'древний сет',
    stats: { minCrit: 1 },
    category: 'gloves',
  });
});

test('supports multiple stats, prefix matching and whitespace', () => {
  assert.deepEqual(parseAuctionSearch('  сил ловк защ  '), {
    text: '',
    stats: { minStr: 1, minAgi: 1, minDef: 1 },
    category: 'all',
  });
});

test('uses the last recognized slot and gives stat keywords precedence', () => {
  assert.deepEqual(parseAuctionSearch('щит кольцо блок'), {
    text: '',
    stats: { minBlock: 1 },
    category: 'ring',
  });
});

test('keeps unknown tokens as normalized search text', () => {
  assert.deepEqual(parseAuctionSearch('  Красный   дракон  '), {
    text: 'красный дракон',
    stats: {},
    category: 'all',
  });
});
