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

/** Масштабировать статы с сохранением кастомных полей (вампиризм, ярость и т.д.) */
function scaleKeep(st: any, mult: number): any {
  const scaled = scaleStats({ s: st.s, a: st.a, d: st.d, m: st.m }, mult);
  return { ...st, s: scaled.s, a: scaled.a, d: scaled.d, m: scaled.m };
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
    drinks: StatRecord;
    collection: number;
    vampirism?: number;      // % вампиризм
    rageDmg?: number;        // +% урон при низком HP
    rageThreshold?: number;   // порог HP для ярости (0-1)
    luckBoost?: number;       // +% ко всем шансам
    resiliencePct?: number;   // -% длительность контроля
    alwaysFirst?: boolean;    // первый ход
    execute?: boolean;        // добивание <10%
    counterOnHit?: number;    // % шанс ответки при ударе
    poisonOnHit?: number;     // % яда от HP при атаке
    blockPen?: number;        // % пробивание блока
    hermitRegen?: boolean;    // Отшельник: +100% реген HP вне боя
    setBonuses?: string[];    // список активных сет-бонусов (для тултипа)
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

    let st: any = addStats(base, sums);

    // --- Сетовые бонусы ---
    const setCounts: Record<string, number> = {};
    const setBonuses: string[] = [];
    for (const item of Object.values(equipment)) {
        const set = (item.extra as any)?.set || (item as any).set;
        if (set) setCounts[set] = (setCounts[set] || 0) + 1;
    }
    for (const [set, count] of Object.entries(setCounts)) {
        if (count < 2) continue;
        // Apply per-set bonuses
        if (set === 'Дуэлянт' || set === 'duelist') {
            if (count >= 2) { extra.counter = Math.round(extra.counter * 1.1); setBonuses.push('Дуэлянт: +10% контратака'); }
            if (count >= 3) { extra.crit = Math.round(extra.crit * 1.15); setBonuses.push('Дуэлянт: +15% крит'); }
            if (count >= 4) { st.vampirism = (st.vampirism || 0) + 5; setBonuses.push('Дуэлянт: крит восстанавливает 5% HP'); }
        } else if (set === 'Берсерк' || set === 'berserk') {
            if (count >= 2) { st = scaleKeep(st, 1.1); setBonuses.push('Берсерк: +10% урон'); }
            if (count >= 3) { st.rageDmg = 20; st.rageThreshold = 0.5; setBonuses.push('Берсерк: +20% урона при HP<50%'); }
            if (count >= 4) { st.blockPen = 20; setBonuses.push('Берсерк: игнор 20% брони'); }
        } else if (set === 'Страж' || set === 'guardian') {
            if (count >= 2) { extra.fullBlock = Math.round(extra.fullBlock * 1.1); setBonuses.push('Страж: +10% блок'); }
            if (count >= 3) { st = scaleKeep(st, 1.15); setBonuses.push('Страж: +15% защита'); }
            if (count >= 4) { st.counterOnHit = 30; setBonuses.push('Страж: 30% ответный удар'); }
        } else if (set === 'Буревестник' || set === 'storm') {
            if (count >= 2) { st.a = Math.round(st.a * 1.1); setBonuses.push('Буревестник: +10% ловкость'); }
            if (count >= 3) { st.alwaysFirst = true; setBonuses.push('Буревестник: первый ход всегда'); }
            if (count >= 4) { extra.dodge = Math.round(extra.dodge * 1.2); setBonuses.push('Буревестник: +20% уклонение'); }
        } else if (set === 'Жнец' || set === 'reaper') {
            if (count >= 2) { st.vampirism = (st.vampirism || 0) + 5; setBonuses.push('Жнец: +5% вампиризм'); }
            if (count >= 3) { st = scaleKeep(st, 1.15); setBonuses.push('Жнец: +15% урон'); }
            if (count >= 4) { st.execute = true; setBonuses.push('Жнец: добивание <10% HP'); }
        } else if (set === 'Крушитель' || set === 'crusher') {
            if (count >= 2) { st.blockPen = 25; setBonuses.push('Крушитель: +25% пробивание блока'); }
            if (count >= 3) { extra.crit = Math.round(extra.crit * 1.1); setBonuses.push('Крушитель: +10% крит'); }
            if (count >= 4) { st = scaleKeep(st, 1.15); setBonuses.push('Крушитель: +15% урон'); }
        } else if (set === 'Гладиатор' || set === 'gladiator') {
            if (count >= 2) { st = scaleKeep(st, 1.15); extra.counter = Math.round(extra.counter * 1.15); setBonuses.push('Гладиатор: +15% урон, +15% контратака'); }
            if (count >= 3) { extra.fullBlock = Math.round(extra.fullBlock * 1.1); setBonuses.push('Гладиатор: +10% блок'); }
            if (count >= 4) { st = scaleKeep(st, 1.1); setBonuses.push('Гладиатор: +10% ко всем статам'); }
        } else if (set === 'Отшельник' || set === 'hermit') {
            if (count >= 2) { st.hermitRegen = true; setBonuses.push('Отшельник: +100% реген HP (вне боя)'); }
            if (count >= 3) { st.poisonOnHit = 3; setBonuses.push('Отшельник: яд 3% HP на 3 хода'); }
            if (count >= 4) { extra.dodge = Math.round(extra.dodge * 1.15); setBonuses.push('Отшельник: +15% уклонение'); }
        }
    }
    st.setBonuses = setBonuses;

    // --- Артефакты ---
    for (const item of Object.values(equipment)) {
        const effect = (item.extra as any)?.effect;
        if (!effect) continue;
        if (effect === 'vampirism') { st.vampirism = (st.vampirism || 0) + 5; }
        else if (effect === 'rage') { st.rageDmg = (st.rageDmg || 0) + 20; st.rageThreshold = Math.min(st.rageThreshold || 1, 0.3); }
        else if (effect === 'luck') { st.luckBoost = 5; }
        else if (effect === 'resilience') { st.resiliencePct = 30; }
    }

    // Бонус коллекции
    if (collectionBonus && collectionBonus > 0) {
        st = scaleKeep(st, 1 + collectionBonus / 100);
    }

    // Бонус гильдейских сооружений
    if (guildBonus && guildBonus > 0) {
        st = scaleKeep(st, 1 + guildBonus / 100);
    }

    return {
        ...st,
        hp: sumStats(st) * 2,
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
