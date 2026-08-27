import assert from 'node:assert/strict';
import test from 'node:test';
import { groupTavernDrinks } from './tavernDrinks.ts';

test('groups drinks and puts universal category first', () => {
    const result = groupTavernDrinks([
        { key: 'x', category: 'Сила' },
        { key: 'u', category: 'Универсальные' },
        { key: 'other', category: null },
        { key: 'a', category: 'Ловкость' },
    ]);

    assert.deepEqual(result, [
        ['Универсальные', [{ key: 'u', category: 'Универсальные' }]],
        ['Ловкость', [{ key: 'a', category: 'Ловкость' }]],
        ['Прочее', [{ key: 'other', category: null }]],
        ['Сила', [{ key: 'x', category: 'Сила' }]],
    ]);
});