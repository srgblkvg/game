import type { Character } from '../contexts/GameContext';

export interface StatBreakdown {
  s: number; a: number; d: number; m: number;
  hp: number;
  baseStats: { s: number; a: number; d: number; m: number };
  equipmentBonuses: { s: number; a: number; d: number; m: number };
  extraStats: { crit: number; dodge: number; counter: number; fullBlock: number };
}

export function calculateStats(
  char: Character,
  drinkBonuses?: { s: number; a: number; d: number; m: number },
  collectionBonus?: number
): StatBreakdown {
  const sums = { s: 0, a: 0, d: 0, m: 0 };
  const extra = { crit: 0, dodge: 0, counter: 0, fullBlock: 0 };

  for (const item of Object.values(char.equipment)) {
    if (item.bonuses) {
      const level = item.upgradeLevel || 0;
      const multiplier = 1 + level * 0.1;
      for (const k of Object.keys(item.bonuses)) {
        sums[k as keyof typeof sums] += Math.round(item.bonuses[k as keyof typeof item.bonuses] * multiplier);
      }
    }
    if (item.extra) {
      for (const k of Object.keys(item.extra)) {
        if (k === 'stamReg') continue;
        extra[k as keyof typeof extra] += item.extra[k as keyof typeof item.extra] || 0;
      }
    }
  }

  // Применяем бонусы напитков
  if (drinkBonuses) {
    sums.s += drinkBonuses.s || 0;
    sums.a += drinkBonuses.a || 0;
    sums.d += drinkBonuses.d || 0;
    sums.m += drinkBonuses.m || 0;
  }

  const s = char.baseStats.s + sums.s;
  const a = char.baseStats.a + sums.a;
  const d = char.baseStats.d + sums.d;
  const m = char.baseStats.m + sums.m;
  const hp = s + a + d + m;

  if (collectionBonus && collectionBonus > 0) {
    const mult = 1 + collectionBonus / 100;
    return {
      s: Math.round(s * mult), a: Math.round(a * mult),
      d: Math.round(d * mult), m: Math.round(m * mult),
      hp: Math.round(hp * mult),
      baseStats: char.baseStats, equipmentBonuses: sums, extraStats: extra,
    };
  }

  return { s, a, d, m, hp, baseStats: char.baseStats, equipmentBonuses: sums, extraStats: extra };
}
