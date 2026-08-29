import type { CharStats, GameItem } from './stats';
import { currentStats } from './stats';
import type { BattleAntiStats } from './battle';
import { calculateCombatPower } from './combatPower';

export interface TournamentPlayerSnapshot {
  id: number;
  name: string;
  level: number;
  base: Record<string, number>;
  equipment: Record<string, GameItem>;
  stats: CharStats;
  combatPowerStats?: CharStats;
  scalablePowerStats?: CharStats;
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
  divisionIndex?: number;
  divisionBasis?: 'level';
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
export function normalizeTournamentSnapshot(
  snapshot: TournamentSnapshot,
  targetPower: number,
  statLimits?: Pick<CharStats, 's' | 'a' | 'd' | 'm' | 'hp'>,
): TournamentSnapshot {
  const source = clone(snapshot);
  const originalStats = clone(source.player.stats);
  // Старые snapshot не содержат combatPowerStats: восстанавливаем их из
  // сохранённых базы и экипировки, а не из полного профиля с внешними бонусами.
  const originalPowerStats = clone(source.player.combatPowerStats
    || currentStats(source.player.base as any, source.player.equipment));
  const originalScalableStats = clone(source.player.scalablePowerStats
    || currentStats(source.player.base as any, source.player.equipment));
  const target = Math.max(1, Math.round(targetPower));
  let low = 0.02;
  let high = 1;
  let bestMultiplier = low;
  let bestPower = 0;
  let upperPower = calculateCombatPower(originalPowerStats, undefined, source.player.level);

  // Разрыв между участниками может быть на несколько порядков. Подбираем
  // верхнюю границу по фактической формуле БМ вместо искусственного cap=50.
  for (let expansion = 0; expansion < 32 && upperPower < target; expansion++) {
    high *= 2;
    const expandedStats = {
      ...originalPowerStats,
      s: Math.max(1, Math.round(originalPowerStats.s * high)),
      a: Math.max(1, Math.round(originalPowerStats.a * high)),
      d: Math.max(1, Math.round(originalPowerStats.d * high)),
      m: Math.max(1, Math.round(originalPowerStats.m * high)),
      hp: Math.max(1, Math.round(originalPowerStats.hp * high)),
    };
    upperPower = calculateCombatPower(expandedStats, undefined, source.player.level);
  }

  for (let attempt = 0; attempt < 32; attempt++) {
    const multiplier = (low + high) / 2;
    const scalableStats = {
      ...originalScalableStats,
      s: Math.max(1, Math.round(originalScalableStats.s * multiplier)),
      a: Math.max(1, Math.round(originalScalableStats.a * multiplier)),
      d: Math.max(1, Math.round(originalScalableStats.d * multiplier)),
      m: Math.max(1, Math.round(originalScalableStats.m * multiplier)),
      hp: Math.max(1, Math.round(originalScalableStats.hp * multiplier)),
    };
    const powerStats = {
      ...originalPowerStats,
      s: Math.max(1, originalPowerStats.s + scalableStats.s - originalScalableStats.s),
      a: Math.max(1, originalPowerStats.a + scalableStats.a - originalScalableStats.a),
      d: Math.max(1, originalPowerStats.d + scalableStats.d - originalScalableStats.d),
      m: Math.max(1, originalPowerStats.m + scalableStats.m - originalScalableStats.m),
      hp: Math.max(1, originalPowerStats.hp + scalableStats.hp - originalScalableStats.hp),
    };
    const candidateStats = {
      ...originalStats,
      s: Math.max(1, originalStats.s + powerStats.s - originalPowerStats.s),
      a: Math.max(1, originalStats.a + powerStats.a - originalPowerStats.a),
      d: Math.max(1, originalStats.d + powerStats.d - originalPowerStats.d),
      m: Math.max(1, originalStats.m + powerStats.m - originalPowerStats.m),
      hp: Math.max(1, originalStats.hp + powerStats.hp - originalPowerStats.hp),
    };
    const exceedsLimit = statLimits && (['s', 'a', 'd', 'm', 'hp'] as const)
      .some(stat => candidateStats[stat] > statLimits[stat]);
    const power = calculateCombatPower(powerStats, undefined, source.player.level);
    if (exceedsLimit) {
      high = multiplier;
      continue;
    }
    if (power <= target && power >= bestPower) {
      bestMultiplier = multiplier;
      bestPower = power;
      source.player.combatPowerStats = powerStats;
      source.player.scalablePowerStats = scalableStats;
      // Повышаем только вклад прокачки и экипировки. Напитки, коллекция и
      // бонусы гильдии уже находятся в full stats и повторно не масштабируются.
      source.player.stats = candidateStats;
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

function targetGap(snapshot: TournamentSnapshot): number {
  // Стабильный разброс 5–10%, чтобы повторная обработка snapshot не меняла результат.
  return 0.05 + (Math.abs(snapshot.player.id) % 6) / 100;
}

/** Подтягивает слабых к лидеру, сохраняя их собственный баланс статов и бонусы. */
export function normalizeTournamentGroup(snapshots: TournamentSnapshot[]): TournamentSnapshot[] {
  if (snapshots.length < 2) return snapshots.map(clone);
  const strongestPower = Math.max(...snapshots.map(snapshot => snapshot.combatPower));
  const leader = snapshots.find(snapshot => snapshot.combatPower === strongestPower)!;
  return snapshots.map(snapshot => {
    const targetPower = Math.round(strongestPower * (1 - targetGap(snapshot)));
    if (snapshot.combatPower >= targetPower) return clone(snapshot);
    return normalizeTournamentSnapshot(snapshot, targetPower, leader.player.stats);
  });
}

function formatPower(power: number): string {
  if (power < 1000) return String(Math.round(power));
  const divisor = power < 1_000_000 ? 1000 : 1_000_000;
  const suffix = power < 1_000_000 ? 'K' : 'M';
  return `${Number((power / divisor).toFixed(2))}${suffix}`;
}

export function formatTournamentNormalizationLog(first: TournamentSnapshot, second: TournamentSnapshot): string {
  return `⚖ Слабейшему участнику временно повышена сила с сохранением его баланса статов. БМ учитывает прокачку, экипировку и коллекцию, но не напитки и бонусы гильдии: ${formatPower(first.combatPower)} и ${formatPower(second.combatPower)}. Реальные характеристики не изменены.`;
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
