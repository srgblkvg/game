import type { CharStats, GameItem } from './stats';
import type { BattleAntiStats } from './battle';

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
