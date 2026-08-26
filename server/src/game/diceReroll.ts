export interface DiceRerollGame {
  dice: string | number[];
  rerolls: number;
}

export interface DiceRerollResponse {
  dice: number[];
  rerollsUsed: number;
  maxRerolls: 2;
}

export class DiceRerollsExhaustedError extends Error {
  constructor() {
    super('Все перебросы использованы');
    this.name = 'DiceRerollsExhaustedError';
  }
}

export class InvalidDiceKeepError extends Error {
  constructor() {
    super('Некорректный выбор костей');
    this.name = 'InvalidDiceKeepError';
  }
}

export function planDiceReroll(
  game: DiceRerollGame,
  keep: unknown,
  random: () => number = Math.random,
): DiceRerollResponse {
  if (game.rerolls >= 2) throw new DiceRerollsExhaustedError();
  if (!keep || !Array.isArray(keep) || keep.some(index => index < 0 || index >= 5)) {
    throw new InvalidDiceKeepError();
  }

  const currentDice: number[] = typeof game.dice === 'string' ? JSON.parse(game.dice) : game.dice;
  const keepSet = new Set(keep);
  const dice = currentDice.map((value, index) => keepSet.has(index) ? value : Math.floor(random() * 6) + 1);

  return {
    dice,
    rerollsUsed: game.rerolls + 1,
    maxRerolls: 2,
  };
}
