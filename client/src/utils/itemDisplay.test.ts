/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { getItemUpgradeLevel } from './itemDisplay.ts';

test('normalizes camelCase and PostgreSQL lowercase upgrade levels', () => {
  assert.equal(getItemUpgradeLevel({ upgradeLevel: 7 }), 7);
  assert.equal(getItemUpgradeLevel({ upgradelevel: 4 }), 4);
  assert.equal(getItemUpgradeLevel({ upgradeLevel: 0, upgradelevel: 6 }), 0);
});

test('returns zero for missing, invalid, or negative levels', () => {
  assert.equal(getItemUpgradeLevel(null), 0);
  assert.equal(getItemUpgradeLevel({ upgradeLevel: 'bad' }), 0);
  assert.equal(getItemUpgradeLevel({ upgradelevel: -1 }), 0);
});
