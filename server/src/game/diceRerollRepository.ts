import type { PoolClient } from 'pg';
import { planDiceReroll, type DiceRerollResponse } from './diceReroll';
import { DiceGameNotActiveError } from './diceFinish';

export async function finishDiceReroll(
  client: PoolClient,
  userId: number,
  gameId: number,
  keep: unknown,
  random: () => number = Math.random,
): Promise<DiceRerollResponse> {
  const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (user.rowCount !== 1) throw new DiceGameNotActiveError();

  const gameResult = await client.query(
    'SELECT id, user_id, dice, rerolls, status FROM dice_games WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [gameId, userId],
  );
  const game = gameResult.rows[0] as { id: number; user_id: number; dice: string | number[]; rerolls: number; status: string } | undefined;
  if (!game || game.status !== 'active') throw new DiceGameNotActiveError();

  const response = planDiceReroll(game, keep, random);
  const updated = await client.query(
    "UPDATE dice_games SET dice = $1, rerolls = rerolls + 1 WHERE id = $2 AND status = 'active' AND rerolls < 2",
    [JSON.stringify(response.dice), gameId],
  );
  if (updated.rowCount !== 1) throw new DiceGameNotActiveError();
  return response;
}
