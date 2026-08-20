/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { groupLoot } from './dungeonLoot.ts';

test('одинаковые камни объединяются в одну стопку', () => {
    const stone = { id: 9, name: 'Рунный белокамень', type: 'craft_item', count: 1 };
    const grouped = groupLoot([stone, { ...stone }, { ...stone }], []);
    assert.equal(grouped.items.length, 1);
    assert.equal(grouped.items[0].count, 3);
});

test('одинаковые страницы объединяются по умению', () => {
    const grouped = groupLoot([], [
        { skillId: 7, name: 'Рывок' },
        { skillId: 7, name: 'Рывок' },
    ]);
    assert.equal(grouped.pages.length, 1);
    assert.equal(grouped.pages[0].count, 2);
});

test('полностью одинаковая экипировка объединяется', () => {
    const item = { name: 'Меч', slot: 'weapon1', rarity_id: 3, bonuses: { s: 5 }, extra: { crit: 1 }, image: '/sword.webp' };
    const grouped = groupLoot([item, { ...item, bonuses: { s: 5 }, extra: { crit: 1 } }], []);
    assert.equal(grouped.items.length, 1);
    assert.equal(grouped.items[0].count, 2);
});

test('legacy и canonical поля предмета группируются одинаково', () => {
    const grouped = groupLoot([
        { name: 'Меч', slot: 'weapon1', rarityId: '3', upgradelevel: '7', bonuses: '{"s":5}', extra: '{"crit":1}', image: '/sword.webp' },
        { name: 'Меч', slot: 'weapon1', rarity_id: 3, upgradeLevel: 7, bonuses: { s: 5 }, extra: { crit: 1 }, image: '/sword.webp' },
    ], []);
    assert.equal(grouped.items.length, 1);
    assert.equal(grouped.items[0].count, 2);
});

test('экипировка с разными бонусами остаётся отдельной', () => {
    const base = { name: 'Меч', slot: 'weapon1', rarity_id: 3, extra: {}, image: '/sword.webp' };
    const grouped = groupLoot([
        { ...base, bonuses: { s: 5 } },
        { ...base, bonuses: { s: 6 } },
    ], []);
    assert.equal(grouped.items.length, 2);
});
