import type { PoolClient } from 'pg';
import { calcBuyCost, calcSellPayout, getSellCoef } from './exchange';
import { changeTreasuryWithClient } from './treasury';

const COMMISSION = 0.05;

interface ExchangeTradeError {
  ok: false;
  status: 400 | 404;
  error?: string;
}

interface ExchangeBuySuccess {
  ok: true;
  body: {
    success: true;
    goldReceived: number;
    silverPaid: number;
    newGold: number;
    newSilver: number;
  };
}

interface ExchangeSellSuccess {
  ok: true;
  body: {
    success: true;
    goldSold: number;
    silverReceived: number;
    newGold: number;
    newSilver: number;
  };
}

export type ExchangeBuyResult = ExchangeTradeError | ExchangeBuySuccess;
export type ExchangeSellResult = ExchangeTradeError | ExchangeSellSuccess;

async function lockReserves(client: PoolClient): Promise<{ silver: number; gold: number }> {
  const row = (await client.query(
    `SELECT c.amount AS silver, e.amount AS gold
     FROM castle_treasury c CROSS JOIN exchange_gold e
     WHERE c.id = 1 AND e.id = 1
     FOR UPDATE OF c, e`,
  )).rows[0];
  if (!row) throw new Error('exchange reserve singleton row missing');
  return { silver: Number(row.silver), gold: Number(row.gold) };
}

async function lockUser(client: PoolClient, userId: number) {
  const row = (await client.query(
    'SELECT id, money, gold FROM users WHERE id = $1 FOR UPDATE',
    [userId],
  )).rows[0];
  return row ? { money: Number(row.money || 0), gold: Number(row.gold || 0) } : null;
}

async function changeGoldReserveWithClient(client: PoolClient, delta: number): Promise<number> {
  const result = await client.query(
    `UPDATE exchange_gold SET amount = amount + $1, updated_at = NOW()
     WHERE id = 1 RETURNING amount`,
    [delta],
  );
  if (result.rowCount !== 1) throw new Error('exchange gold singleton row missing');
  return Number(result.rows[0].amount);
}

async function insertTrade(client: PoolClient, price: number, silver: number, gold: number): Promise<void> {
  await client.query(
    `INSERT INTO exchange_history (price, silver, gold, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [price, silver, gold],
  );
}

export async function buyGoldWithClient(
  client: PoolClient,
  userId: number,
  goldAmount: number,
): Promise<ExchangeBuyResult> {
  const reserves = await lockReserves(client);
  if (goldAmount >= reserves.gold) {
    return { ok: false, status: 400, error: 'Недостаточно золота в резерве' };
  }
  const user = await lockUser(client, userId);
  if (!user) return { ok: false, status: 404, error: 'Пользователь не найден' };

  const rawCost = calcBuyCost(goldAmount, reserves.silver, reserves.gold);
  const totalCost = Math.ceil(rawCost * (1 + COMMISSION));
  if (user.money < totalCost) {
    return { ok: false, status: 400, error: `Недостаточно серебра. Нужно ${totalCost.toLocaleString()}` };
  }

  const updatedUser = (await client.query(
    `UPDATE users SET money = money - $1, gold = gold + $2
     WHERE id = $3 RETURNING money, gold`,
    [totalCost, goldAmount, userId],
  )).rows[0];
  await changeTreasuryWithClient(client, totalCost, 'exchange_buy');
  const newGoldReserve = await changeGoldReserveWithClient(client, -goldAmount);
  const newSilverReserve = reserves.silver + totalCost;
  await insertTrade(
    client,
    Math.round(newSilverReserve / newGoldReserve),
    newSilverReserve,
    newGoldReserve,
  );

  return {
    ok: true,
    body: {
      success: true,
      goldReceived: goldAmount,
      silverPaid: totalCost,
      newGold: Number(updatedUser.gold),
      newSilver: Number(updatedUser.money),
    },
  };
}

export async function sellGoldWithClient(
  client: PoolClient,
  userId: number,
  goldAmount: number,
): Promise<ExchangeSellResult> {
  const reserves = await lockReserves(client);
  const sellCoef = getSellCoef(reserves.silver);
  if (sellCoef <= 0) {
    return { ok: false, status: 400, error: 'Продажа золота недоступна (мало серебра в казне)' };
  }
  const user = await lockUser(client, userId);
  if (!user) return { ok: false, status: 404 };
  if (user.gold < goldAmount) return { ok: false, status: 400, error: 'Недостаточно золота' };

  const rawPayout = calcSellPayout(goldAmount, reserves.silver, reserves.gold);
  const payout = Math.floor(rawPayout * sellCoef * (1 - COMMISSION));
  if (reserves.silver < payout) {
    return { ok: false, status: 400, error: 'В казне недостаточно серебра' };
  }

  const updatedUser = (await client.query(
    `UPDATE users SET gold = gold - $1, money = money + $2
     WHERE id = $3 RETURNING money, gold`,
    [goldAmount, payout, userId],
  )).rows[0];
  await changeTreasuryWithClient(client, -payout, 'exchange_sell');
  const newGoldReserve = await changeGoldReserveWithClient(client, goldAmount);
  const newSilverReserve = reserves.silver - payout;
  await insertTrade(
    client,
    Math.round(newSilverReserve / newGoldReserve),
    newSilverReserve,
    newGoldReserve,
  );

  return {
    ok: true,
    body: {
      success: true,
      goldSold: goldAmount,
      silverReceived: payout,
      newGold: Number(updatedUser.gold),
      newSilver: Number(updatedUser.money),
    },
  };
}
