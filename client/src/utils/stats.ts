import type { Character } from '../contexts/GameContext';

export function calculateStats(char: Character) {
  const sums = { s: 0, a: 0, d: 0, m: 0 };
  const extra = { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 };

  for (const item of Object.values(char.equipment)) {
    if (item.bonuses) {
      const level = item.upgradeLevel || 0;
      const multiplier = 1 + level * 0.05;
      for (const k of Object.keys(item.bonuses)) {
        sums[k as keyof typeof sums] += Math.round(item.bonuses[k as keyof typeof item.bonuses] * multiplier);
      }
    }
    if (item.extra) {
      for (const k of Object.keys(item.extra)) {
        extra[k as keyof typeof extra] += item.extra[k as keyof typeof item.extra] || 0;
      }
    }
  }

  const s = char.baseStats.s + sums.s;
  const a = char.baseStats.a + sums.a;
  const v = char.baseStats.v;
  const d = char.baseStats.d + sums.d;
  const m = char.baseStats.m + sums.m;
  const hp = s + a + v + d + m;

  // Стоимость атаки
  let cost = 12;
  const weapon1 = char.equipment['weapon1'];
  const weapon2 = char.equipment['weapon2'];
  if (weapon1) cost += weapon1.rarity * 6 * (weapon1.name?.includes('двуручн') ? 1.6 : 1);
  if (weapon2) cost += weapon2.rarity * 6;
  const attackCost = Math.round(cost);

  const hpRegen = 1 + (extra.hpRegen || 0);
  const staminaRegen = 1 + (extra.stamReg || 0);

  return {
    s,
    a,
    v,
    d,
    m,
    hp,
    maxStamina: 100,
    attackCost,
    hpRegen,
    staminaRegen,
  };
}