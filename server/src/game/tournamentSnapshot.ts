import type { CharStats, GameItem } from './stats';
import type { BattleAntiStats } from './battle';
import { calculateCombatPower } from './combatPower';

export interface TournamentPlayerSnapshot {
  id: number;
  name: string;
  level: number;
  base: Record<string, number>;
  equipment: Record<string, GameItem>;
  stats: CharStats;
  drinkBonuses?: Record<string, number>;
  collectionBonus?: number;
  guildBonus?: number;
  activeEquipSlot?: number;
  playerTalents?: Record<string, { level: number; progress: number }>;
  guildTalents?: Record<string, { level: number; progress: number }>;
  antiStats?: BattleAntiStats;
}

export interface TournamentSnapshot {
  version: 1;
  combatPower: number;
  player: TournamentPlayerSnapshot;
  registeredAt: number;
  place?: number;
  prize?: number;
  result?: { place: number; prize: number };
  normalization?: {
    originalPower: number;
    targetPower: number;
    appliedPower: number;
    multiplier: number;
  };
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function createTournamentSnapshot(player: TournamentPlayerSnapshot, combatPower: number): TournamentSnapshot {
  return {
    version: 1,
    combatPower: Math.max(0, Math.round(combatPower)),
    player: clone(player),
    registeredAt: Math.floor(Date.now() / 1000),
  };
}

export function playerFromTournamentSnapshot(snapshot: TournamentSnapshot) {
  const player = clone(snapshot.player);
  return {
    ...player,
    money: 0,
    currentHp: player.stats.hp,
  };
}

/** Временно приводит основные статы snapshot к общей турнирной БМ. */
export function normalizeTournamentSnapshot(snapshot: TournamentSnapshot, targetPower: number): TournamentSnapshot {
  const source = clone(snapshot);
  const originalStats = clone(source.player.stats);
  const target = Math.max(1, Math.round(targetPower));
  let low = 0.02;
  let high = 50;
  let bestMultiplier = 1;
  let bestPower = calculateCombatPower(originalStats, source.player.antiStats, source.player.level);

  for (let attempt = 0; attempt < 32; attempt++) {
    const multiplier = (low + high) / 2;
    const stats = {
      ...originalStats,
      s: Math.max(1, Math.round(originalStats.s * multiplier)),
      a: Math.max(1, Math.round(originalStats.a * multiplier)),
      d: Math.max(1, Math.round(originalStats.d * multiplier)),
      m: Math.max(1, Math.round(originalStats.m * multiplier)),
      hp: Math.max(1, Math.round(originalStats.hp * multiplier)),
    };
    const power = calculateCombatPower(stats, source.player.antiStats, source.player.level);
    if (Math.abs(power - target) < Math.abs(bestPower - target)) {
      bestMultiplier = multiplier;
      bestPower = power;
      source.player.stats = stats;
    }
    if (power < target) low = multiplier;
    else high = multiplier;
  }

  source.normalization = {
    originalPower: snapshot.combatPower,
    targetPower: target,
    appliedPower: bestPower,
    multiplier: Number(bestMultiplier.toFixed(4)),
  };
  return source;
}

/** Выдаёт всем участникам одинаковый временный боевой профиль среднего участника. */
export function normalizeTournamentGroup(snapshots: TournamentSnapshot[]): TournamentSnapshot[] {
  if (snapshots.length < 2) return snapshots.map(clone);
  const logAverage = snapshots.reduce((sum, snapshot) => sum + Math.log(Math.max(1, snapshot.combatPower)), 0) / snapshots.length;
  const targetPower = Math.exp(logAverage);
  const reference = snapshots.reduce((best, snapshot) =>
    Math.abs(Math.log(Math.max(1, snapshot.combatPower)) - Math.log(targetPower))
      < Math.abs(Math.log(Math.max(1, best.combatPower)) - Math.log(targetPower)) ? snapshot : best
  );

  return snapshots.map(snapshot => {
    const normalized = clone(snapshot);
    normalized.player = {
      ...clone(reference.player),
      id: snapshot.player.id,
      name: snapshot.player.name,
    };
    normalized.normalization = {
      originalPower: snapshot.combatPower,
      targetPower: reference.combatPower,
      appliedPower: reference.combatPower,
      multiplier: 1,
    };
    return normalized;
  });
}

function formatPower(power: number): string {
  if (power < 1000) return String(Math.round(power));
  const divisor = power < 1_000_000 ? 1000 : 1_000_000;
  const suffix = power < 1_000_000 ? 'K' : 'M';
  return `${Number((power / divisor).toFixed(2))}${suffix}`;
}

export function formatTournamentNormalizationLog(first: TournamentSnapshot, second: TournamentSnapshot): string {
  return `⚖ Сила участников временно выровнена для турнирного боя. Исходная БМ: ${formatPower(first.combatPower)} и ${formatPower(second.combatPower)}. Реальные характеристики не изменены.`;
}

export function mergeTournamentResult(snapshot: Partial<TournamentSnapshot> | null | undefined, place: number, prize: number): TournamentSnapshot {
  const source: any = snapshot && (snapshot as any).version === 1 && (snapshot as any).player
    ? clone(snapshot)
    : { version: 1, combatPower: 0, player: null, registeredAt: 0 };
  source.result = { place, prize };
  source.place = place;
  source.prize = prize;
  return source as TournamentSnapshot;
}

export function parseTournamentSnapshot(raw: unknown): TournamentSnapshot | null {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!value || typeof value !== 'object') return null;
    const snapshot = value as any;
    return snapshot.version === 1 && snapshot.player?.stats ? snapshot as TournamentSnapshot : null;
  } catch {
    return null;
  }
}
