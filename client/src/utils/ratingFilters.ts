export interface RatingFilter {
  label: string;
  min: number;
}

export const RATING_FILTERS: readonly RatingFilter[] = [
  { label: 'Все звания', min: 0 },
  { label: '👑 Смерть (2100+)', min: 2100 },
  { label: '♦♦♦ Вечность (1900+)', min: 1900 },
  { label: '♦♦ Бездна (1700+)', min: 1700 },
  { label: '♦ Погибель (1500+)', min: 1500 },
  { label: '▪▪▪ Кошмар (1300+)', min: 1300 },
  { label: '▪▪ Кровь (1100+)', min: 1100 },
  { label: '▪ Тень (900+)', min: 900 },
  { label: '••• Шёпот (600+)', min: 600 },
  { label: '•• Кость (300+)', min: 300 },
  { label: '• Пепел (0+)', min: 0 },
];
