import type { Character } from '../contexts/GameContext';

// ── Реестр статов (синхронизирован с сервером) ──
export const PRIMARY_STATS = ['s', 'a', 'd', 'm'] as const;
export type PrimaryStat = typeof PRIMARY_STATS[number];

// Русские названия для UI
export const STAT_LABELS: Record<string, string> = {
  s: 'Сила',
  a: 'Ловкость',
  d: 'Защита',
  m: 'Мастерство',
};

export type StatRecord = { s: number; a: number; d: number; m: number };
export type ExtraRecord = { crit: number; dodge: number; counter: number; fullBlock: number };

// ── Хелперы ──

export function sumStats(s: StatRecord): number {
  return (s.s || 0) + (s.a || 0) + (s.m || 0);
}

export function addStats(a: StatRecord, b: StatRecord): StatRecord {
  return { s: a.s + b.s, a: a.a + b.a, d: a.d + b.d, m: a.m + b.m };
}

// ── Совместимость со старым кодом ──

export interface StatBreakdown extends StatRecord {
  hp: number;
  baseStats: StatRecord;
  equipmentBonuses: StatRecord;
  extraStats: ExtraRecord;
}

export function calculateStats(
  char: Character,
  drinkBonuses?: StatRecord,
  collectionBonus?: number,
  guildBonus?: number
): StatBreakdown {
  const sums: StatRecord = { s: 0, a: 0, d: 0, m: 0 };
  const extra: ExtraRecord = { crit: 0, dodge: 0, counter: 0, fullBlock: 0 };

  for (const item of Object.values(char.equipment)) {
    if (item.bonuses) {
      const level = item.upgradeLevel || 0;
      const multiplier = 1 + level * 0.1;
      for (const k of PRIMARY_STATS) {
        sums[k] += Math.round((item.bonuses[k] || 0) * multiplier);
      }
    }
    if (item.extra) {
      for (const k of Object.keys(item.extra)) {
        if (k === 'stamReg') continue;
        if (k in extra) extra[k as keyof ExtraRecord] += item.extra[k as keyof ExtraRecord] || 0;
      }
    }
  }

  if (drinkBonuses) {
    for (const k of PRIMARY_STATS) {
      sums[k] += drinkBonuses[k] || 0;
    }
  }

  let st = addStats(char.baseStats, sums);

  if (collectionBonus && collectionBonus > 0) {
    st = { s: Math.round(st.s * (1 + collectionBonus / 100)), a: Math.round(st.a * (1 + collectionBonus / 100)), d: Math.round(st.d * (1 + collectionBonus / 100)), m: Math.round(st.m * (1 + collectionBonus / 100)) };
  }
  if (guildBonus && guildBonus > 0) {
    st = { s: Math.round(st.s * (1 + guildBonus / 100)), a: Math.round(st.a * (1 + guildBonus / 100)), d: Math.round(st.d * (1 + guildBonus / 100)), m: Math.round(st.m * (1 + guildBonus / 100)) };
  }

  return { ...st, hp: sumStats(st), baseStats: char.baseStats, equipmentBonuses: sums, extraStats: extra };
}

/** Удобная обёртка — вытаскивает все бонусы из Character */
export function getCharStats(char: Character): StatBreakdown {
  return calculateStats(
    char,
    char.drinkBonuses,
    char.collectionCount || 0,
    char.guildBonus
  );
}
