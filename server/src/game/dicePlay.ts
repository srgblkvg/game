export const DAILY_DICE_LIMIT = 10;
export const MAX_REROLLS = 2;
const ACTIVE_GAME_MAX_AGE_MS = 5 * 60 * 1000;
const ALLOWED_BETS = new Set([10, 100, 1000]);

export class DicePlayError extends Error {}
export class ActiveDiceGameError extends DicePlayError { constructor() { super('У вас уже есть активная игра'); } }
export class DiceDailyLimitError extends DicePlayError { constructor(count: number) { super(`Дневной лимит исчерпан (${count}/${DAILY_DICE_LIMIT})`); } }
export class DiceInsufficientBalanceError extends DicePlayError { constructor() { super('Недостаточно серебра'); } }

export interface LockedDiceUser { id: number; money: number }
export interface ActiveDiceGame { id: number; createdAt: Date | string | number }
export interface NewDiceGame { userId: number; entryFee: number; dice: number[]; createdAt: Date }
export interface DicePlayTransaction {
  lockUser(userId: number): Promise<LockedDiceUser | null>;
  lockActiveGame(userId: number): Promise<ActiveDiceGame | null>;
  countTodayGames(userId: number): Promise<number>;
  expireGame(gameId: number): Promise<void>;
  deductMoney(userId: number, amount: number): Promise<void>;
  insertGame(input: NewDiceGame): Promise<{ id: number }>;
}
export interface DicePlayRepository { transaction<T>(callback: (tx: DicePlayTransaction) => Promise<T>): Promise<T> }
export interface DicePlayInput { userId: number; bet?: unknown; now?: Date; random?: () => number }
export interface DicePlayResponse { gameId: number; dice: number[]; rerollsUsed: 0; maxRerolls: 2; entryFee: number }

function normalizedBet(value: unknown): number { return ALLOWED_BETS.has(value as number) ? value as number : 10; }
function toMillis(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
  return new Date(value).getTime();
}
export function rollDice(random: () => number = Math.random): number[] { return Array.from({ length: 5 }, () => Math.floor(random() * 6) + 1); }

export async function playDice(repository: DicePlayRepository, input: DicePlayInput): Promise<DicePlayResponse> {
  const bet = normalizedBet(input.bet);
  const now = input.now || new Date();
  return repository.transaction(async tx => {
    const user = await tx.lockUser(input.userId);
    if (!user) throw new DiceInsufficientBalanceError();
    const today = await tx.countTodayGames(input.userId);
    if (today >= DAILY_DICE_LIMIT) throw new DiceDailyLimitError(today);
    const active = await tx.lockActiveGame(input.userId);
    if (active) {
      if (toMillis(now) - toMillis(active.createdAt) <= ACTIVE_GAME_MAX_AGE_MS) throw new ActiveDiceGameError();
      await tx.expireGame(active.id);
    }
    if (user.money < bet) throw new DiceInsufficientBalanceError();
    const dice = rollDice(input.random);
    await tx.deductMoney(input.userId, bet);
    const game = await tx.insertGame({ userId: input.userId, entryFee: bet, dice, createdAt: now });
    return { gameId: game.id, dice, rerollsUsed: 0, maxRerolls: 2, entryFee: bet };
  });
}
