export interface DungeonContinueVitals {
  playerHp: number;
  playerMaxHp: number;
}

export function resolveDungeonContinueVitals(
  saved: DungeonContinueVitals,
  activeRun?: DungeonContinueVitals | null,
): DungeonContinueVitals {
  return activeRun ? {
    playerHp: activeRun.playerHp,
    playerMaxHp: activeRun.playerMaxHp,
  } : saved;
}

export interface DungeonRegenTickInput {
  playerHp: number;
  playerMaxHp: number;
  regenRate: number;
  tickSeconds: number;
  remainder: number;
}

export interface DungeonRegenTickResult {
  playerHp: number;
  remainder: number;
}

export function applyDungeonRegenTick({
  playerHp,
  playerMaxHp,
  regenRate,
  tickSeconds,
  remainder,
}: DungeonRegenTickInput): DungeonRegenTickResult {
  if (playerHp >= playerMaxHp) return { playerHp: playerMaxHp, remainder: 0 };

  const hpPerSecond = playerMaxHp * 0.03 * regenRate;
  const accumulated = remainder + hpPerSecond * tickSeconds;
  const restoredHp = Math.floor(accumulated);
  const nextHp = Math.min(playerMaxHp, playerHp + restoredHp);

  return {
    playerHp: nextHp,
    remainder: nextHp >= playerMaxHp ? 0 : accumulated - restoredHp,
  };
}
