export interface TournamentDivision {
  index: number;
  key: string;
  label: string;
  minPower: number;
  maxPower: number;
}

export interface DivisionProgress {
  division: number;
  championships: number;
}

export interface DivisionChampionshipResult extends DivisionProgress {
  promoted: boolean;
}

export const TOURNAMENT_DIVISIONS: readonly TournamentDivision[] = [
  { index: 0, key: 'copper', label: 'Медный', minPower: 1, maxPower: 99 },
  { index: 1, key: 'bronze', label: 'Бронзовый', minPower: 100, maxPower: 499 },
  { index: 2, key: 'iron', label: 'Железный', minPower: 500, maxPower: 2_499 },
  { index: 3, key: 'steel', label: 'Стальной', minPower: 2_500, maxPower: 9_999 },
  { index: 4, key: 'silver', label: 'Серебряный', minPower: 10_000, maxPower: 49_999 },
  { index: 5, key: 'gold', label: 'Золотой', minPower: 50_000, maxPower: 249_999 },
  { index: 6, key: 'platinum', label: 'Платиновый', minPower: 250_000, maxPower: 1_249_999 },
  { index: 7, key: 'mithril', label: 'Мифриловый', minPower: 1_250_000, maxPower: 6_249_999 },
  { index: 8, key: 'adamant', label: 'Адамантовый', minPower: 6_250_000, maxPower: 31_249_999 },
  { index: 9, key: 'orichalcum', label: 'Орихалковый', minPower: 31_250_000, maxPower: Number.POSITIVE_INFINITY },
];

export function getTournamentDivision(combatPower: number): TournamentDivision {
  const power = Math.max(1, Math.round(combatPower));
  return TOURNAMENT_DIVISIONS.find(division => power <= division.maxPower)
    || TOURNAMENT_DIVISIONS[TOURNAMENT_DIVISIONS.length - 1]!;
}

export function assignTournamentDivision(savedDivision: number | null | undefined, combatPower: number): number {
  if (savedDivision != null && Number.isInteger(Number(savedDivision))) {
    return Math.max(0, Math.min(TOURNAMENT_DIVISIONS.length - 1, Number(savedDivision)));
  }
  return getTournamentDivision(combatPower).index;
}

export function applyDivisionChampionship(progress: DivisionProgress): DivisionChampionshipResult {
  const division = Math.max(0, Math.min(TOURNAMENT_DIVISIONS.length - 1, Math.floor(progress.division)));
  const championships = Math.max(0, Math.min(2, Math.floor(progress.championships))) + 1;
  if (championships < 3) return { division, championships, promoted: false };
  if (division >= TOURNAMENT_DIVISIONS.length - 1) {
    return { division, championships: 0, promoted: false };
  }
  return { division: division + 1, championships: 0, promoted: true };
}

export function getTournamentDivisionByIndex(index: number): TournamentDivision {
  const safeIndex = Math.max(0, Math.min(TOURNAMENT_DIVISIONS.length - 1, Math.floor(index)));
  return TOURNAMENT_DIVISIONS[safeIndex]!;
}
