import { strict as assert } from 'node:assert';
import test from 'node:test';
import { RATING_FILTERS } from './ratingFilters.ts';

test('rating filters preserve the existing labels and thresholds', () => {
  assert.deepEqual(RATING_FILTERS, [
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
  ]);
});

test('rating filters are ordered from the broadest option to the highest rank', () => {
  assert.equal(RATING_FILTERS[0]?.min, 0);
  assert.equal(RATING_FILTERS[1]?.min, 2100);
  assert.equal(RATING_FILTERS.at(-1)?.min, 0);
});
