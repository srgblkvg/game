import type { PoolClient, QueryResult } from 'pg';
import { db } from '../db/index';
import { DiceGameNotActiveError, planDiceFinish, type DiceFinishPlan } from './diceFinish';

export interface DiceFinishRepositoryResult extends DiceFinishPlan {
  gameId: number;
  userId: number;
}

/**
 * Finishes one active dice game inside the caller's transaction.
 * The caller must use db.tx (or issue BEGIN/COMMIT) around this operation.
 */
export async function finishDiceAtomic(
  client: PoolClient,
  userId: number,
  gameId: number,
): Promise<DiceFinishRepositoryResult> {
  // Deliberately lock the user before the game: every finish uses this order.
  const userResult = await client.query(
    'SELECT id FROM users WHERE id = $1 FOR UPDATE',
    [userId],
  );
  if (userResult.rowCount !== 1) throw new DiceGameNotActiveError();

  const gameResult = await client.query(
    'SELECT id, user_id, entry_fee, dice, status FROM dice_games WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [gameId, userId],
  );
  const game = gameResult.rows[0] as { id: number; user_id: number; entry_fee: number; dice: string | number[]; status: string } | undefined;
  if (!game || game.status !== 'active') throw new DiceGameNotActiveError();

  const plan = planDiceFinish(game);
  await client.query(
    'UPDATE users SET money = money + $1, casino_games_played = casino_games_played + $2, casino_won = casino_won + $3, casino_lost = casino_lost + $4 WHERE id = $5',
    [plan.response.payout, plan.casino.gamesPlayed, plan.casino.won, plan.casino.lost, userId],
  );
  const gameUpdate: QueryResult = await client.query(
    "UPDATE dice_games SET status = 'finished', combo = $1, payout = $2 WHERE id = $3 AND status = 'active'",
    [plan.response.combo, plan.response.payout, gameId],
  );
  if (gameUpdate.rowCount !== 1) throw new DiceGameNotActiveError();

  return { ...plan, gameId, userId };
}

export function createPgDiceFinishRepository() {
  return {
    async finish(input: { userId: number; gameId: number }) {
      return db.tx(client => finishDiceAtomic(client, input.userId, input.gameId));
    },
  };
}

export async function finishDiceGame(
  repository: ReturnType<typeof createPgDiceFinishRepository>,
  input: { userId: number; gameId: number },
) {
  return (await repository.finish(input)).response;
}
