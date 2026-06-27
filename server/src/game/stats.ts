// ── Реестр статов (ЕДИНСТВЕННОЕ место перечисления) ──
// Добавить новый стат: добавить в PRIMARY_STATS + поле в StatRecord ниже

export const PRIMARY_STATS = ['s', 'a', 'd', 'm'] as const;
export type PrimaryStat = typeof PRIMARY_STATS[number]; // 's' | 'a' | 'd' | 'm'

export const EXTRA_STATS = ['crit', 'dodge', 'counter', 'fullBlock'] as const;
export type ExtraStat = typeof EXTRA_STATS[number];

// Обобщённый тип стата
export type StatRecord = { s: number; a: number; d: number; m: number };
export type ExtraRecord = { crit: number; dodge: number; counter: number; fullBlock: number };

// ── Хелперы ──

/** HP = S + A + M (защита даёт блок, не HP) */
export function sumStats(s: StatRecord): number {
  return (s.s || 0) + (s.a || 0) + (s.m || 0);
}

/** Масштабировать все статы на множитель */
export function scaleStats(s: StatRecord, mult: number): StatRecord {
  return {
    s: Math.round((s.s || 0) * mult),
    a: Math.round((s.a || 0) * mult),
    d: Math.round((s.d || 0) * mult),
    m: Math.round((s.m || 0) * mult),
  };
}

/** Сложить два StatRecord */
export function addStats(a: StatRecord, b: StatRecord): StatRecord {
  return {
    s: (a.s || 0) + (b.s || 0),
    a: (a.a || 0) + (b.a || 0),
    d: (a.d || 0) + (b.d || 0),
    m: (a.m || 0) + (b.m || 0),
  };
}

/** Сумма extra-статов */
export function sumExtra(e: ExtraRecord): number {
  return EXTRA_STATS.reduce((sum, k) => sum + (e[k] || 0), 0);
}

// ── Боевые механики: имена статов ──
// ЕДИНСТВЕННОЕ место правки при добавлении нового стата

type StatKey = string;

const F = {
  dodgeDef:   'a',
  dodgePen:   'm',
  crit:       'm',
  block:      'd',
  damage:     's',
  counterDef: ['m', 'a'],
  counterTgt: ['m', 'd'],
  stunAtk:    ['s', 'm'],
  stunDef:    ['s', 'd'],
} as const;

function sv(stats: CharStats, key: any): number {
  if (Array.isArray(key)) {
    let sum = 0;
    for (const k of key) sum += (stats as any)[k] || 0;
    return sum;
  }
  return (stats as any)[key] || 0;
}

export { F, sv };

// ── Типы предметов и персонажа ──

export interface GameItem {
    id?: string | number;
    name?: string;
    slot: string;
    rarity_id: number;
    bonuses: StatRecord;
    extra: ExtraRecord;
    upgradeLevel?: number;
}

export interface CharStats extends StatRecord {
    hp: number;
    bonuses: StatRecord;
    extra: ExtraRecord;
    drinks?: StatRecord;
    collection?: number;
}

export interface StatSums extends StatRecord {}

// ── Вычисление статов персонажа ──

export function currentStats(
    base: StatRecord,
    equipment: Record<string, GameItem>,
    drinkBonuses?: StatRecord,
    collectionBonus?: number,
    guildBonus?: number
): CharStats {
    const sums: StatRecord = { s: 0, a: 0, d: 0, m: 0 };
    const extra: ExtraRecord = { crit: 0, dodge: 0, counter: 0, fullBlock: 0 };

    for (const item of Object.values(equipment)) {
        const level = item.upgradeLevel || 0;
        const multiplier = 1 + level * 0.1;
        if (item.bonuses) {
            for (const k of PRIMARY_STATS) {
                sums[k] = (sums[k] || 0) + Math.round((item.bonuses[k] || 0) * multiplier);
            }
        }
        if (item.extra) {
            for (const k of EXTRA_STATS) {
                extra[k] = (extra[k] || 0) + Math.round((item.extra[k] || 0) * multiplier);
            }
        }
    }

    // Применяем бонусы напитков
    if (drinkBonuses) {
        for (const k of PRIMARY_STATS) {
            sums[k] += drinkBonuses[k] || 0;
        }
    }

    let st = addStats(base, sums);

    // Бонус коллекции
    if (collectionBonus && collectionBonus > 0) {
        st = scaleStats(st, 1 + collectionBonus / 100);
    }

    // Бонус гильдейских сооружений
    if (guildBonus && guildBonus > 0) {
        st = scaleStats(st, 1 + guildBonus / 100);
    }

    return {
        ...st,
        hp: sumStats(st),
        bonuses: sums,
        extra,
        drinks: drinkBonuses || { s: 0, a: 0, d: 0, m: 0 },
        collection: collectionBonus || 0,
    };
}

export function isSlotCompatible(slotId: string, item: GameItem): boolean {
    if (!item) return false;
    const itemSlot = item.slot;
    if (itemSlot === 'ring' || itemSlot === 'ring1' || itemSlot === 'ring2') return slotId === 'ring1' || slotId === 'ring2';
    if (itemSlot === 'weapon1') return slotId === 'weapon1';
    if (itemSlot === 'shield') return slotId === 'shield';
    return itemSlot === slotId;
}
