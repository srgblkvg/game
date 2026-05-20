"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentStats = currentStats;
exports.isSlotCompatible = isSlotCompatible;
function currentStats(base, equipment) {
    const sums = { s: 0, a: 0, d: 0, m: 0 };
    const extra = { stamReg: 0, crit: 0, dodge: 0, counter: 0, fullBlock: 0, hpRegen: 0 };
    for (const item of Object.values(equipment)) {
        if (item.bonuses) {
            const level = item.upgradeLevel || 0;
            const multiplier = 1 + level * 0.05;
            for (const k of Object.keys(item.bonuses)) {
                const key = k;
                sums[k] = (sums[k] || 0) + Math.round(item.bonuses[key] * multiplier);
            }
        }
        if (item.extra) {
            for (const k of Object.keys(item.extra)) {
                const key = k;
                extra[k] = (extra[k] || 0) + (item.extra[key] || 0);
            }
        }
    }
    extra.hpRegen = 1 + (extra.hpRegen || 0);
    const st = {
        s: base.s + (sums.s || 0),
        a: base.a + (sums.a || 0),
        v: base.v,
        d: base.d + (sums.d || 0),
        m: base.m + (sums.m || 0),
    };
    const hp = st.s + st.a + st.v + st.d + st.m;
    let cost = 12;
    const weapon1 = equipment['weapon1'];
    const weapon2 = equipment['weapon2'];
    if (weapon1)
        cost += weapon1.rarity * 6 * (weapon1.name?.includes('двуручн') ? 1.6 : 1);
    if (weapon2)
        cost += weapon2.rarity * 6;
    return {
        ...st,
        hp,
        maxStamina: 100,
        regen: 1 + (extra.stamReg || 0),
        attackCost: Math.round(cost),
        bonuses: {
            s: sums.s || 0,
            a: sums.a || 0,
            d: sums.d || 0,
            m: sums.m || 0,
        },
        extra: {
            stamReg: extra.stamReg || 0,
            crit: extra.crit || 0,
            dodge: extra.dodge || 0,
            counter: extra.counter || 0,
            fullBlock: extra.fullBlock || 0,
            hpRegen: extra.hpRegen || 0,
        },
    };
}
function isSlotCompatible(slotId, item) {
    if (!item)
        return false;
    const itemSlot = item.slot;
    if (itemSlot === 'ring1' || itemSlot === 'ring2')
        return slotId === 'ring1' || slotId === 'ring2';
    if (itemSlot === 'weapon1')
        return slotId === 'weapon1';
    if (itemSlot === 'weapon2')
        return slotId === 'weapon2';
    return itemSlot === slotId;
}
//# sourceMappingURL=stats.js.map