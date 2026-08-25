export type DiceCombo = 'poker' | 'quads' | 'fullhouse' | 'straight' | 'set' | 'twopair' | 'pair' | 'none';

export interface DiceFinishGame {
  id: number;
  entry_fee: number;
  dice: string | number[];
}

export interface DiceFinishResponse {
  dice: number[];
  combo: DiceCombo;
  comboName: string;
  payout: number;
  profit: number;
}

export interface DiceFinishPlan {
  response: DiceFinishResponse;
  casino: { gamesPlayed: 1; won: number; lost: number };
}

const PAYOUTS: Record<DiceCombo, { name: string; mult: number }> = {
  poker: { name: 'Покер', mult: 100 },
  quads: { name: 'Каре', mult: 25 },
  fullhouse: { name: 'Фулл-хаус', mult: 8 },
  straight: { name: 'Стрит', mult: 5 },
  set: { name: 'Сет', mult: 3 },
  twopair: { name: 'Две пары', mult: 0 },
  pair: { name: 'Пара', mult: 0 },
  none: { name: 'Ничего', mult: 0 },
};

export class DiceGameNotActiveError extends Error {
  readonly statusCode = 404;

  constructor() {
    super('Игра не найдена');
    this.name = 'DiceGameNotActiveError';
  }
}

function parseDice(value: string | number[]): number[] {
  let dice: unknown;
  try {
    dice = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new Error('Invalid dice JSON');
  }
  if (!Array.isArray(dice) || dice.length !== 5 || dice.some(die => !Number.isInteger(die) || die < 1 || die > 6)) {
    throw new Error('Invalid dice');
  }
  return [...dice];
}

export function getDiceCombo(dice: number[]): DiceCombo {
  const counts = new Map<number, number>();
  for (const die of dice) counts.set(die, (counts.get(die) || 0) + 1);
  const values = [...counts.values()].sort((a, b) => b - a);
  const sorted = [...dice].sort((a, b) => a - b);
  const isStraight = sorted.join(',') === '1,2,3,4,5' || sorted.join(',') === '2,3,4,5,6';

  if (values[0] === 5) return 'poker';
  if (values[0] === 4) return 'quads';
  if (values[0] === 3 && values[1] === 2) return 'fullhouse';
  if (isStraight) return 'straight';
  if (values[0] === 3) return 'set';
  if (values[0] === 2 && values[1] === 2) return 'twopair';
  if (values[0] === 2) return 'pair';
  return 'none';
}

export function planDiceFinish(game: DiceFinishGame | null | undefined): DiceFinishPlan {
  if (!game) throw new DiceGameNotActiveError();
  const dice = parseDice(game.dice);
  const combo = getDiceCombo(dice);
  const payoutRule = PAYOUTS[combo];
  const payout = payoutRule.mult * game.entry_fee;
  return {
    response: { dice, combo, comboName: payoutRule.name, payout, profit: payout - game.entry_fee },
    casino: { gamesPlayed: 1, won: payout, lost: game.entry_fee },
  };
}

export function finishDice(game: DiceFinishGame | null | undefined): DiceFinishResponse {
  return planDiceFinish(game).response;
}
