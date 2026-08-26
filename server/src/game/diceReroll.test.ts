/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DiceRerollsExhaustedError,
  InvalidDiceKeepError,
  planDiceReroll,
} from './diceReroll';

test('reroll preserves kept indices and consumes random values left to right', () => {
  const rolls = [0, 0.999];
  const result = planDiceReroll(
    { dice: '[1,2,3,4,5]', rerolls: 0 },
    [0, 2, 4],
    () => rolls.shift()!,
  );

  assert.deepEqual(result, {
    dice: [1, 1, 3, 6, 5],
    rerollsUsed: 1,
    maxRerolls: 2,
  });
  assert.deepEqual(rolls, []);
});

test('empty keep rerolls all dice and duplicate indices remain valid', () => {
  assert.deepEqual(
    planDiceReroll({ dice: [1, 2, 3, 4, 5], rerolls: 1 }, [], () => 0),
    { dice: [1, 1, 1, 1, 1], rerollsUsed: 2, maxRerolls: 2 },
  );

  assert.deepEqual(
    planDiceReroll({ dice: [1, 2, 3, 4, 5], rerolls: 0 }, [1, 1], () => 0),
    { dice: [1, 2, 1, 1, 1], rerollsUsed: 1, maxRerolls: 2 },
  );
});

test('legacy keep validation rejects missing, non-array and out-of-range indices', () => {
  for (const keep of [undefined, null, [-1], [5]]) {
    assert.throws(
      () => planDiceReroll({ dice: [1, 2, 3, 4, 5], rerolls: 0 }, keep, () => 0),
      InvalidDiceKeepError,
    );
  }
});

test('legacy validation accepts string indices without treating them as kept numeric positions', () => {
  assert.deepEqual(
    planDiceReroll({ dice: [6, 6, 6, 6, 6], rerolls: 0 }, ['1'], () => 0),
    { dice: [1, 1, 1, 1, 1], rerollsUsed: 1, maxRerolls: 2 },
  );
});

test('reroll limit is checked before keep validation', () => {
  assert.throws(
    () => planDiceReroll({ dice: [1, 2, 3, 4, 5], rerolls: 2 }, undefined, () => 0),
    DiceRerollsExhaustedError,
  );
});

test('stored JSON dice is accepted with exact flat response shape', () => {
  assert.deepEqual(
    Object.keys(planDiceReroll({ dice: '[6,5,4,3,2]', rerolls: 0 }, [0, 1, 2, 3, 4], () => 0)),
    ['dice', 'rerollsUsed', 'maxRerolls'],
  );
});

export {};
