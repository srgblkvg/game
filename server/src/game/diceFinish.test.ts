/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { finishDice, getDiceCombo, planDiceFinish } from './diceFinish';

test('finishDice preserves the legacy poker payout and response shape', () => {
  assert.deepEqual(finishDice({ id: 7, entry_fee: 10, dice: [6, 6, 6, 6, 6] }), {
    dice: [6, 6, 6, 6, 6], combo: 'poker', comboName: 'Покер', payout: 1000, profit: 990,
  });
});

test('finishDice accepts the stored JSON string and preserves all legacy combinations', () => {
  const cases: Array<[number[], string, string, number]> = [
    [[1, 1, 1, 1, 2], 'quads', 'Каре', 250],
    [[1, 1, 1, 2, 2], 'fullhouse', 'Фулл-хаус', 80],
    [[1, 2, 3, 4, 5], 'straight', 'Стрит', 50],
    [[3, 3, 3, 4, 5], 'set', 'Сет', 30],
    [[1, 1, 2, 2, 3], 'twopair', 'Две пары', 0],
    [[1, 1, 2, 3, 4], 'pair', 'Пара', 0],
    [[1, 2, 3, 4, 6], 'none', 'Ничего', 0],
  ];
  for (const [dice, combo, comboName, payout] of cases) {
    const result = finishDice({ id: 1, entry_fee: 10, dice: JSON.stringify(dice) });
    assert.equal(result.combo, combo);
    assert.equal(result.comboName, comboName);
    assert.equal(result.payout, payout);
    assert.deepEqual(result.dice, dice);
    assert.equal(result.profit, payout - 10);
  }
});

test('getDiceCombo keeps straight precedence over non-winning pairs and supports both straights', () => {
  assert.equal(getDiceCombo([6, 5, 4, 3, 2]), 'straight');
  assert.equal(getDiceCombo([1, 2, 3, 4, 5]), 'straight');
});

test('finishDice rejects malformed dice rather than changing payout semantics', () => {
  assert.throws(() => finishDice({ id: 1, entry_fee: 10, dice: 'not-json' }), /dice/i);
});

test('finishDice maps a missing active game to a not-active domain error', () => {
  assert.throws(() => finishDice(null), /не найдена|not active/i);
});

test('planDiceFinish uses the gross payout for casino won and the entry fee for casino lost', () => {
  const plan = planDiceFinish({ id: 1, entry_fee: 100, dice: [2, 2, 2, 2, 3] });
  assert.equal(plan.response.payout, 2500);
  assert.deepEqual(plan.casino, { gamesPlayed: 1, won: 2500, lost: 100 });
});

void assert;
