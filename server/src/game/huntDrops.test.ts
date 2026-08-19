import assert from 'node:assert/strict';
import test from 'node:test';
import {
    HUNT_DROP_MULTIPLIER,
    MATERIAL_DROP_CHANCE,
    MYTHIC_RESOURCE_DROP_CHANCE,
    STONE_DROP_CHANCE,
    getCraftMaterialChance,
    getStoneChance,
    scaleItemDropTable,
} from './huntDrops';

test('uses the current Bestiary hunt multiplier for every drop category', () => {
    assert.equal(HUNT_DROP_MULTIPLIER, 2 / 3);
    assert.equal(MATERIAL_DROP_CHANCE, 0.35 * (2 / 3));
    assert.equal(STONE_DROP_CHANCE, 0.05 * (2 / 3));
    assert.equal(MYTHIC_RESOURCE_DROP_CHANCE, 0.01 * (2 / 3));
});

test('craft material preview chance equals the actual material roll and rarity weight', () => {
    assert.equal(getCraftMaterialChance(0.1667), 0.1667 * MATERIAL_DROP_CHANCE);
    assert.equal(getCraftMaterialChance(0), 0);
});

test('stone preview chance uses the same weighted roll as the attack', () => {
    const weights = { 'Рунный булыжник': 0.03, 'Руна Рубина': 0.001 };
    const total = 0.031;
    assert.equal(getStoneChance(weights['Рунный булыжник'], total), (0.03 / total) * STONE_DROP_CHANCE);
    assert.equal(getStoneChance(0, total), 0);
});

test('item drop table is scaled once for both preview and attack', () => {
    assert.deepEqual(scaleItemDropTable([{ rarity: 6, chance: 0.15 }]), [{ rarity: 6, chance: 0.15 * (2 / 3) }]);
});
