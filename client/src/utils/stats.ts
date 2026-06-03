import type { Character } from '../contexts/GameContext';

export function calculateStats(char: Character) {
  const sums = { s: 0, a: 0, d: 0, m: 0 };
  const extra = { crit: 0, dodge: 0, counter: 0, fullBlock: 0 };

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
        if (k === 'stamReg') continue; // stamina removed
        extra[k as keyof typeof extra] += item.extra[k as keyof typeof item.extra] || 0;
      }
    }
  }

  const s = char.baseStats.s + sums.s;
  const a = char.baseStats.a + sums.a;
  const d = char.baseStats.d + sums.d;
  const m = char.baseStats.m + sums.m;
  const hp = s + a + d + m;

  return {
    s,
    a,
    d,
    m,
    hp,
  };
}
