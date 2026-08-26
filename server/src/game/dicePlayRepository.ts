import type { PoolClient } from 'pg';
import { db } from '../db/index';
import { type DicePlayRepository, type DicePlayTransaction, type NewDiceGame, playDice, type DicePlayResponse } from './dicePlay';

function millis(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  return new Date(value).getTime();
}

/**
 * PostgreSQL transaction adapter for dice play. The user row is locked before
 * the active-game query, establishing the lock order used by all play paths.
 *
 * collectGuildTax is intentionally not called here: the current helper uses
 * the global pool, so calling it inside this PoolClient transaction would not
 * be atomic. Callers must use the returned taxRisk to decide whether to run
 * the tax post-commit (or provide a future transaction-aware tax helper).
 */
export function dicePlayTransaction(client: PoolClient): DicePlayTransaction {
  return {
    async lockUser(userId) {
      const row = (await client.query('SELECT id, money FROM users WHERE id = $1 FOR UPDATE', [userId])).rows[0];
      return row ? { id: Number(row.id), money: Number(row.money) } : null;
    },
    async lockActiveGame(userId) {
      const row = (await client.query(
        "SELECT id, created_at FROM dice_games WHERE user_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [userId],
      )).rows[0];
      return row ? { id: Number(row.id), createdAt: row.created_at } : null;
    },
    async countTodayGames(userId) {
      const row = (await client.query(
        'SELECT COUNT(*) AS count FROM dice_games WHERE user_id = $1 AND created_at::date = CURRENT_DATE',
        [userId],
      )).rows[0];
      return Number(row?.count || 0);
    },
    async expireGame(gameId) {
      await client.query("UPDATE dice_games SET status = 'expired', combo = 'none', payout = 0 WHERE id = $1 AND status = 'active'", [gameId]);
    },
    async deductMoney(userId, amount) {
      const result = await client.query('UPDATE users SET money = money - $1 WHERE id = $2 AND money >= $1', [amount, userId]);
      if (result.rowCount !== 1) throw new Error('Недостаточно серебра');
    },
    async insertGame(input: NewDiceGame) {
      const result = await client.query(
        "INSERT INTO dice_games (user_id, entry_fee, dice, rerolls, status, created_at) VALUES ($1, $2, $3, 0, 'active', $4) RETURNING id",
        [input.userId, input.entryFee, JSON.stringify(input.dice), input.createdAt],
      );
      return { id: Number(result.rows[0]?.id) };
    },
  };
}

export async function startDicePlayAtomic(
  client: PoolClient,
  userId: number,
  bet: unknown,
  now: Date = new Date(),
  random?: () => number,
): Promise<DicePlayResponse & { id: number; taxRisk: 'post-commit-global-pool' }> {
  const input = random === undefined ? { userId, bet, now } : { userId, bet, now, random };
  const response = await playDice({ transaction: callback => callback(dicePlayTransaction(client)) }, input);
  return { ...response, id: response.gameId, taxRisk: 'post-commit-global-pool' };
}

export function createPgDicePlayRepository(): DicePlayRepository {
  return { transaction: callback => db.tx(client => callback(dicePlayTransaction(client))) };
}

export { millis };
