import assert from 'node:assert/strict';
import test from 'node:test';
import { sortInventoryItems, type InventorySortOrder } from './inventorySorting.ts';

test('sorts inventory by rarity without mutating the input', () => {
    const items = [{ id: 'a', rarity_id: 3 }, { id: 'b', rarity_id: null }, { id: 'c', rarity_id: 1 }];

    assert.deepEqual(sortInventoryItems(items, 'asc').map(item => item.id), ['b', 'c', 'a']);
    assert.deepEqual(sortInventoryItems(items, 'desc').map(item => item.id), ['a', 'c', 'b']);
    assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c']);
});

test('returns the original array for the none order', () => {
    const items = [{ id: 'a', rarity_id: 1 }];
    const result = sortInventoryItems(items, 'none');

    assert.strictEqual(result, items);
});

test('accepts every inventory sort order', () => {
    const orders: InventorySortOrder[] = ['none', 'asc', 'desc'];
    assert.equal(orders.length, 3);
});
