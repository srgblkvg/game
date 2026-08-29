import { formatClockCountdown } from './clockCountdown';

export interface DungeonRegenPresentationInput {
  playerHp: number;
  playerMaxHp: number;
  regenRate: number;
}

export interface DungeonRegenPresentation {
  hpPerSecond: number;
  secondsToFull: number;
  timeToFull: string;
}

export function getDungeonRegenPresentation({
  playerHp,
  playerMaxHp,
  regenRate,
}: DungeonRegenPresentationInput): DungeonRegenPresentation {
  const rawHpPerSecond = Math.max(0, playerMaxHp * 0.03 * regenRate);
  const hpPerSecond = Math.round(rawHpPerSecond * 10) / 10;
  const missingHp = Math.max(0, playerMaxHp - playerHp);
  const secondsToFull = missingHp > 0 && rawHpPerSecond > 0
    ? Math.ceil(missingHp / rawHpPerSecond)
    : 0;

  return {
    hpPerSecond,
    secondsToFull,
    timeToFull: formatClockCountdown(secondsToFull),
  };
}
