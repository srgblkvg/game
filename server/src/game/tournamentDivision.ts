export interface TournamentDivision {
  index: number;
  key: string;
  label: string;
  tier: number;
  minLevel: number;
  maxLevel: number;
  icon: string;
}

export const TOURNAMENT_DIVISIONS: readonly TournamentDivision[] = [
  { index: 0, key: 'copper', label: 'Медный', tier: 1, minLevel: 1, maxLevel: 5, icon: '🥉' },
  { index: 1, key: 'bronze', label: 'Бронзовый', tier: 2, minLevel: 3, maxLevel: 7, icon: '🥉' },
  { index: 2, key: 'iron', label: 'Железный', tier: 3, minLevel: 5, maxLevel: 9, icon: '🥈' },
  { index: 3, key: 'steel', label: 'Стальной', tier: 4, minLevel: 7, maxLevel: 11, icon: '🥈' },
  { index: 4, key: 'silver', label: 'Серебряный', tier: 5, minLevel: 9, maxLevel: 13, icon: '🥈' },
  { index: 5, key: 'gold', label: 'Золотой', tier: 6, minLevel: 11, maxLevel: 15, icon: '🥇' },
  { index: 6, key: 'platinum', label: 'Платиновый', tier: 7, minLevel: 13, maxLevel: 17, icon: '🥇' },
  { index: 7, key: 'mithril', label: 'Мифриловый', tier: 8, minLevel: 15, maxLevel: 19, icon: '🥇' },
  { index: 8, key: 'adamant', label: 'Адамантиновый', tier: 9, minLevel: 17, maxLevel: 21, icon: '👑' },
  { index: 9, key: 'orichalcum', label: 'Орихалковый', tier: 10, minLevel: 19, maxLevel: 999, icon: '💎' },
];

export function getTournamentDivisionByIndex(index: number): TournamentDivision {
  const safeIndex = Math.max(0, Math.min(TOURNAMENT_DIVISIONS.length - 1, Math.floor(index)));
  return TOURNAMENT_DIVISIONS[safeIndex]!;
}

export function getTournamentDivisionByKey(key: string): TournamentDivision | undefined {
  return TOURNAMENT_DIVISIONS.find(division => division.key === key);
}

export function getEligibleTournamentDivisions(level: number): TournamentDivision[] {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return TOURNAMENT_DIVISIONS.filter(
    division => safeLevel >= division.minLevel && safeLevel <= division.maxLevel,
  );
}

export function isLevelEligibleForTournamentDivision(level: number, key: string): boolean {
  const division = getTournamentDivisionByKey(key);
  return Boolean(division && level >= division.minLevel && level <= division.maxLevel);
}
