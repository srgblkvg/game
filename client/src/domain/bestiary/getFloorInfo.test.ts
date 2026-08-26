/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { getFloorInfo, type FloorMob } from './getFloorInfo.ts';

const mobs: FloorMob[] = [
  {
    location: 'Ад I',
    level: 12,
    gold_min: 8,
    gold_max: 30,
    xp: 10,
    lootImages: [
      { rarity: 1, name: 'Железо', image: '/iron-low.webp', chance: '2.5' },
      { rarity: -1, name: 'Камень I', image: '/stone-low.webp', chance: 1 },
    ],
    itemDropTable: [
      { rarity: 1, chance: 3 },
      { rarity: 0, chance: 0 },
    ],
    equipmentDrops: [
      { rarity: '2', name: 'Редкий предмет', chance: '4', setChance: '0.1' },
      { rarity: 0, name: 'Обычный предмет', chance: 2, setChance: 0.2 },
    ],
    artifactMaterialDrop: { name: 'Осколок', image: '/shard-low.webp', chance: '1.5' },
  },
  {
    location: 'Лес',
    level: 99,
    gold_min: 1,
    gold_max: 999,
    xp: 999,
    lootImages: [{ rarity: 5, name: 'Не с этажа', image: '/other.webp', chance: 100 }],
  },
  {
    location: 'Ад I',
    level: 7,
    gold_min: 3,
    gold_max: 20,
    xp: 5,
    lootImages: [
      { rarity: -1, name: 'Камень II', image: '/stone-two.webp', chance: 7 },
      { rarity: 1, name: 'Сталь', image: '/steel.webp', chance: '6.5' },
      { rarity: -1, name: 'Камень I', image: '/stone-best.webp', chance: '9' },
    ],
    itemDropTable: [
      { rarity: 2, chance: 1 },
      { rarity: 1, chance: 5 },
      { rarity: 0, chance: -1 },
    ],
    equipmentDrops: [
      { rarity: 1, name: 'Необычный предмет', chance: 3, setChance: 0.3 },
      { rarity: 2, name: 'Редкий предмет лучше', chance: 8 },
    ],
    artifactMaterialDrop: { name: 'Осколок', image: '/shard-best.webp', chance: 2 },
  },
  {
    location: 'Ад I',
    level: 9,
    gold_min: 6,
    gold_max: 40,
    xp: 0,
    artifactMaterialDrop: { name: 'Пыль', image: '/dust.webp', chance: 4 },
  },
];

test('summarizes only mobs on the requested floor and preserves level range semantics', () => {
  const result = getFloorInfo(mobs, 'Ад I');

  assert.equal(result.count, 3);
  assert.equal(result.minLevel, 7);
  assert.equal(result.maxLevel, 12);
  assert.equal(result.goldMin, 3);
  assert.equal(result.goldMax, 40);
  assert.equal(result.avgXp, 5);
});

test('deduplicates floor loot by current keys, maximum chance, and first-seen Map order', () => {
  const result = getFloorInfo(mobs, 'Ад I');

  assert.deepEqual(result.lootImages, [
    { rarity: -1, name: 'Камень II', image: '/stone-two.webp', chance: 7 },
    { rarity: 1, name: 'Сталь', image: '/steel.webp', chance: '6.5' },
    { rarity: -1, name: 'Камень I', image: '/stone-best.webp', chance: '9' },
  ]);
  assert.deepEqual(result.craftMaterials, [result.lootImages[1]]);
  assert.deepEqual(result.upgradeStones, [result.lootImages[0], result.lootImages[2]]);
  assert.deepEqual(result.itemDropTable, [
    { rarity: 2, chance: 1 },
    { rarity: 1, chance: 5 },
    { rarity: 0, chance: 0 },
  ]);
});

test('summarizes equipment, artifact materials, and average summed set chance exactly', () => {
  const result = getFloorInfo(mobs, 'Ад I');

  assert.deepEqual(result.equipmentDrops, [
    { rarity: 0, name: 'Обычный предмет', chance: 2, setChance: 0.2 },
    { rarity: 1, name: 'Необычный предмет', chance: 3, setChance: 0.3 },
    { rarity: 2, name: 'Редкий предмет лучше', chance: 8 },
  ]);
  assert.deepEqual(result.artifactMaterials, [
    { name: 'Осколок', image: '/shard-best.webp', chance: 2 },
    { name: 'Пыль', image: '/dust.webp', chance: 4 },
  ]);
  assert.ok(Math.abs(result.setChance - 0.2) < Number.EPSILON);
});

test('returns the current empty-floor sentinel values and every summary field', () => {
  assert.deepEqual(getFloorInfo(mobs, 'Нет такого этажа'), {
    count: 0,
    minLevel: 0,
    maxLevel: 0,
    goldMin: Infinity,
    goldMax: 0,
    avgXp: 0,
    lootImages: [],
    itemDropTable: [],
    equipmentDrops: [],
    craftMaterials: [],
    upgradeStones: [],
    artifactMaterials: [],
    setChance: 0,
  });
});
