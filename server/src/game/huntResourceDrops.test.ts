/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { HUNT_DROP_MULTIPLIER, MYTHIC_RESOURCE_DROP_CHANCE, MYTHIC_RESOURCE_DROPS } from './huntResourceDrops';

test('шанс материалов артефактов и Кристалла душ увеличен ровно вдвое', () => {
    const previousChance = 1 / 150;
    const expectedChance = 1 / 75;
    assert.ok(Math.abs(HUNT_DROP_MULTIPLIER - 2 / 3) < Number.EPSILON);
    assert.ok(Math.abs(MYTHIC_RESOURCE_DROP_CHANCE - expectedChance) < Number.EPSILON);
    assert.ok(Math.abs(MYTHIC_RESOURCE_DROP_CHANCE - previousChance * 2) < Number.EPSILON);
});

test('единый повышенный ролл включает ресурсы артефактов и Кристалл душ', () => {
    assert.equal(MYTHIC_RESOURCE_DROPS[30], 'Кровь демона');
    assert.equal(MYTHIC_RESOURCE_DROPS[47], 'Эссенция гнева');
    assert.equal(MYTHIC_RESOURCE_DROPS[48], 'Пыльца фей');
    assert.equal(MYTHIC_RESOURCE_DROPS[49], 'Кристалл душ');
    assert.equal(MYTHIC_RESOURCE_DROPS[50], 'Чешуя василиска');
    assert.equal(MYTHIC_RESOURCE_DROPS[60], 'Кристалл душ');
});
