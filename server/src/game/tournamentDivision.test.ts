/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assignTournamentDivision,
  applyDivisionChampionship,
  getTournamentDivision,
} from './tournamentDivision';

test('первый дивизион назначается по боевой мощи', () => {
  assert.equal(assignTournamentDivision(null, 99), 0);
  assert.equal(assignTournamentDivision(null, 100), 1);
  assert.equal(assignTournamentDivision(null, 10_000), 4);
});

test('сохранённый динамический дивизион не меняется от новой БМ', () => {
  assert.equal(assignTournamentDivision(2, 1), 2);
  assert.equal(assignTournamentDivision(2, 50_000_000), 2);
});

test('три чемпионства в текущем дивизионе повышают на одну ступень и сбрасывают прогресс', () => {
  assert.deepEqual(applyDivisionChampionship({ division: 2, championships: 0 }), { division: 2, championships: 1, promoted: false });
  assert.deepEqual(applyDivisionChampionship({ division: 2, championships: 1 }), { division: 2, championships: 2, promoted: false });
  assert.deepEqual(applyDivisionChampionship({ division: 2, championships: 2 }), { division: 3, championships: 0, promoted: true });
});

test('верхний дивизион не выходит за предел справочника', () => {
  const top = getTournamentDivision(Number.MAX_SAFE_INTEGER).index;
  assert.deepEqual(applyDivisionChampionship({ division: top, championships: 2 }), { division: top, championships: 0, promoted: false });
});

test('границы крупных дивизионов совпадают с принятой шкалой', () => {
  assert.equal(getTournamentDivision(1).label, 'Медный');
  assert.equal(getTournamentDivision(100).label, 'Бронзовый');
  assert.equal(getTournamentDivision(500).label, 'Железный');
  assert.equal(getTournamentDivision(2_500).label, 'Стальной');
  assert.equal(getTournamentDivision(10_000).label, 'Серебряный');
});
