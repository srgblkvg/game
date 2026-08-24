/// <reference types="node" />
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const tradePath = resolve(__dirname, 'exchangeTrade.ts');
const tradeSource = existsSync(tradePath) ? readFileSync(tradePath, 'utf8') : '';
const routeSource = readFileSync(resolve(__dirname, '../routes/exchange.ts'), 'utf8');

const routeBranch = (start: string, end: string) => {
  const from = routeSource.indexOf(start);
  const to = routeSource.indexOf(end, from + start.length);
  return from >= 0 && to > from ? routeSource.slice(from, to) : '';
};

test('exchange trade locks both reserves and user on one client', () => {
  assert.match(tradeSource, /FOR UPDATE OF c, e/i);
  assert.match(tradeSource, /FROM users WHERE id = \$1 FOR UPDATE/i);
  assert.match(tradeSource, /changeTreasuryWithClient\(client,/);
});

test('user, gold reserve and history mutations use the transaction client', () => {
  assert.match(tradeSource, /client\.query\([\s\S]*UPDATE users/i);
  assert.match(tradeSource, /UPDATE exchange_gold SET amount = amount \+ \$1[\s\S]*RETURNING amount/i);
  assert.match(tradeSource, /INSERT INTO exchange_history/);
  assert.doesNotMatch(tradeSource, /recordTrade|updateGoldReserve|addToTreasury|deductFromTreasury/);
});

test('buy and sell routes delegate one transaction and isolate post-commit broadcast failures', () => {
  const buy = routeBranch("router.post('/exchange/buy'", "router.post('/exchange/sell'");
  const sell = routeBranch("router.post('/exchange/sell'", 'export default router');
  for (const branch of [buy, sell]) {
    assert.match(branch, /await db\.tx\(/);
    assert.match(branch, /void broadcastStatus\(\)\.catch\([^)]*logger\.error/);
    assert.doesNotMatch(branch, /await broadcastStatus\(\)/);
    assert.ok(branch.indexOf('await db.tx(') < branch.indexOf('void broadcastStatus()'));
    assert.ok(branch.indexOf('res.json(result.body)') < branch.indexOf('void broadcastStatus()'));
    assert.doesNotMatch(branch, /db\.run\(|addToTreasury|deductFromTreasury|updateGoldReserve|recordTrade/);
  }
});

test('trade implementation preserves existing AMM formulas and commission rounding', () => {
  assert.match(tradeSource, /calcBuyCost\(goldAmount, reserves\.silver, reserves\.gold\)/);
  assert.match(tradeSource, /Math\.ceil\(rawCost \* \(1 \+ COMMISSION\)\)/);
  assert.match(tradeSource, /calcSellPayout\(goldAmount, reserves\.silver, reserves\.gold\)/);
  assert.match(tradeSource, /Math\.floor\(rawPayout \* sellCoef \* \(1 - COMMISSION\)\)/);
});
