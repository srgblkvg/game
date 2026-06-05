export interface GameItem {
    id?: string | number;
    name?: string;
    slot: string;
    rarity_id: number;
    bonuses: { s: number; a: number; d: number; m: number };
    extra: {
        crit: number;
        dodge: number;
        counter: number;
        fullBlock: number;
    };
    upgradeLevel?: number;
}

export interface CharStats {
    s: number;
    a: number;
    d: number;
    m: number;
    hp: number;
    bonuses: { s: number; a: number; d: number; m: number };
    extra: {
        crit: number;
        dodge: number;
        counter: number;
        fullBlock: number;
    };
}

export interface StatSums {
    s: number;
    a: number;
    d: number;
    m: number;
}

export function currentStats(
    base: { s: number; a: number; d: number; m: number },
    equipment: Record<string, GameItem>,
    drinkBonuses?: { s: number; a: number; d: number; m: number }
): CharStats {
    const sums: StatSums = { s: 0, a: 0, d: 0, m: 0 };
    const extra: Record<string, number> = { crit: 0, dodge: 0, counter: 0, fullBlock: 0 };

    for (const item of Object.values(equipment)) {
        if (item.bonuses) {
            const level = item.upgradeLevel || 0;
            const multiplier = 1 + level * 0.05;
            for (const k of Object.keys(item.bonuses)) {
                const key = k as keyof StatSums;
                sums[key] = (sums[key] || 0) + Math.round(item.bonuses[key as keyof typeof item.bonuses] * multiplier);
            }
        }
        if (item.extra) {
            for (const k of Object.keys(item.extra)) {
                const key = k as keyof typeof item.extra;
                extra[key] = (extra[key] || 0) + (item.extra[key] || 0);
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

    const st = {
        s: base.s + (sums.s || 0),
        a: base.a + (sums.a || 0),
        d: base.d + (sums.d || 0),
        m: base.m + (sums.m || 0),
    };

    const hp = st.s + st.a + st.d + st.m;

    return {
        ...st,
        hp,
        bonuses: { s: sums.s || 0, a: sums.a || 0, d: sums.d || 0, m: sums.m || 0 },
        extra: {
            crit: extra.crit || 0,
            dodge: extra.dodge || 0,
            counter: extra.counter || 0,
            fullBlock: extra.fullBlock || 0,
        },
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
