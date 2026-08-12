"use strict";
// ── Реестр статов (ЕДИНСТВЕННОЕ место перечисления) ──
// Добавить новый стат: добавить в PRIMARY_STATS + поле в StatRecord ниже
Object.defineProperty(exports, "__esModule", { value: true });
exports.F = exports.EXTRA_STATS = exports.PRIMARY_STATS = void 0;
exports.sumStats = sumStats;
exports.scaleStats = scaleStats;
exports.addStats = addStats;
exports.sumExtra = sumExtra;
exports.sv = sv;
exports.currentStats = currentStats;
exports.isSlotCompatible = isSlotCompatible;
exports.PRIMARY_STATS = ['s', 'a', 'd', 'm'];
exports.EXTRA_STATS = ['crit', 'dodge', 'counter', 'fullBlock'];
// ── Хелперы ──
/** HP = S + A + M (защита даёт блок, не HP) */
function sumStats(s) {
    return (s.s || 0) + (s.a || 0) + (s.m || 0);
}
/** Масштабировать все статы на множитель */
function scaleStats(s, mult) {
    return {
        s: Math.round((s.s || 0) * mult),
        a: Math.round((s.a || 0) * mult),
        d: Math.round((s.d || 0) * mult),
        m: Math.round((s.m || 0) * mult),
    };
}
/** Масштабировать статы с сохранением кастомных полей (вампиризм, ярость и т.д.) */
function scaleKeep(st, mult) {
    const scaled = scaleStats({ s: st.s, a: st.a, d: st.d, m: st.m }, mult);
    return { ...st, s: scaled.s, a: scaled.a, d: scaled.d, m: scaled.m };
}
/** Сложить два StatRecord */
function addStats(a, b) {
    return {
        s: (a.s || 0) + (b.s || 0),
        a: (a.a || 0) + (b.a || 0),
        d: (a.d || 0) + (b.d || 0),
        m: (a.m || 0) + (b.m || 0),
    };
}
/** Сумма extra-статов */
function sumExtra(e) {
    return exports.EXTRA_STATS.reduce((sum, k) => sum + (e[k] || 0), 0);
}
const F = {
    dodgeDef: 'a',
    dodgePen: 'm',
    crit: 'm',
    block: 'd',
    damage: 's',
    counterDef: ['m', 'a'],
    counterTgt: ['m', 'd'],
    stunAtk: ['s', 'm'],
    stunDef: ['s', 'd'],
};
exports.F = F;
function sv(stats, key) {
    if (Array.isArray(key)) {
        let sum = 0;
        for (const k of key)
            sum += stats[k] || 0;
        return sum;
    }
    return stats[key] || 0;
}
// ── Вычисление статов персонажа ──
function currentStats(base, equipment, drinkBonuses, collectionBonus, guildBonus) {
    const sums = { s: 0, a: 0, d: 0, m: 0 };
    const extra = { crit: 0, dodge: 0, counter: 0, fullBlock: 0 };
    for (const item of Object.values(equipment)) {
        const level = item.upgradeLevel || 0;
        const multiplier = 1 + level * 0.1;
        if (item.bonuses) {
            for (const k of exports.PRIMARY_STATS) {
                sums[k] = (sums[k] || 0) + Math.round((item.bonuses[k] || 0) * multiplier);
            }
        }
        if (item.extra) {
            for (const k of exports.EXTRA_STATS) {
                extra[k] = (extra[k] || 0) + Math.round((item.extra[k] || 0) * multiplier);
            }
        }
        // Проклятие (curse) — не скалируется от улучшения
        if (item.curseStat && item.curseValue && exports.PRIMARY_STATS.includes(item.curseStat)) {
            sums[item.curseStat] = (sums[item.curseStat] || 0) + (item.curseValue || 0);
        }
    }
    // Применяем бонусы напитков
    if (drinkBonuses) {
        for (const k of exports.PRIMARY_STATS) {
            sums[k] += drinkBonuses[k] || 0;
        }
    }
    let st = addStats(base, sums);
    // --- Сетовые бонусы ---
    const setCounts = {};
    const setBonuses = [];
    for (const item of Object.values(equipment)) {
        const set = item.extra?.set || item.set;
        if (set)
            setCounts[set] = (setCounts[set] || 0) + 1;
    }
    for (const [set, count] of Object.entries(setCounts)) {
        if (count < 2)
            continue;
        // Apply per-set bonuses
        if (set === 'Дуэлянт' || set === 'duelist') {
            if (count >= 2) {
                extra.counter = Math.round(extra.counter * 1.1);
                setBonuses.push('Дуэлянт: +10% контратака');
            }
            if (count >= 3) {
                extra.crit = Math.round(extra.crit * 1.15);
                setBonuses.push('Дуэлянт: +15% крит');
            }
            if (count >= 4) {
                st.vampirism = (st.vampirism || 0) + 5;
                setBonuses.push('Дуэлянт: крит восстанавливает 5% HP');
            }
        }
        else if (set === 'Берсерк' || set === 'berserk') {
            if (count >= 2) {
                st = scaleKeep(st, 1.1);
                setBonuses.push('Берсерк: +10% урон');
            }
            if (count >= 3) {
                st.rageDmg = 20;
                st.rageThreshold = 0.5;
                setBonuses.push('Берсерк: +20% урона при HP<50%');
            }
            if (count >= 4) {
                st.blockPen = 20;
                setBonuses.push('Берсерк: игнор 20% брони');
            }
        }
        else if (set === 'Страж' || set === 'guardian') {
            if (count >= 2) {
                extra.fullBlock = Math.round(extra.fullBlock * 1.1);
                setBonuses.push('Страж: +10% блок');
            }
            if (count >= 3) {
                st = scaleKeep(st, 1.15);
                setBonuses.push('Страж: +15% защита');
            }
            if (count >= 4) {
                st.counterOnHit = 30;
                setBonuses.push('Страж: 30% ответный удар');
            }
        }
        else if (set === 'Буревестник' || set === 'storm') {
            if (count >= 2) {
                st.a = Math.round(st.a * 1.1);
                setBonuses.push('Буревестник: +10% ловкость');
            }
            if (count >= 3) {
                st.alwaysFirst = true;
                setBonuses.push('Буревестник: первый ход всегда');
            }
            if (count >= 4) {
                extra.dodge = Math.round(extra.dodge * 1.2);
                setBonuses.push('Буревестник: +20% уклонение');
            }
        }
        else if (set === 'Жнец' || set === 'reaper') {
            if (count >= 2) {
                st.vampirism = (st.vampirism || 0) + 5;
                setBonuses.push('Жнец: +5% вампиризм');
            }
            if (count >= 3) {
                st = scaleKeep(st, 1.15);
                setBonuses.push('Жнец: +15% урон');
            }
            if (count >= 4) {
                st.execute = true;
                setBonuses.push('Жнец: добивание <10% HP');
            }
        }
        else if (set === 'Крушитель' || set === 'crusher') {
            if (count >= 2) {
                st.blockPen = 25;
                setBonuses.push('Крушитель: +25% пробивание блока');
            }
            if (count >= 3) {
                extra.crit = Math.round(extra.crit * 1.1);
                setBonuses.push('Крушитель: +10% крит');
            }
            if (count >= 4) {
                st = scaleKeep(st, 1.15);
                setBonuses.push('Крушитель: +15% урон');
            }
        }
        else if (set === 'Гладиатор' || set === 'gladiator') {
            if (count >= 2) {
                st = scaleKeep(st, 1.15);
                extra.counter = Math.round(extra.counter * 1.15);
                setBonuses.push('Гладиатор: +15% урон, +15% контратака');
            }
            if (count >= 3) {
                extra.fullBlock = Math.round(extra.fullBlock * 1.1);
                setBonuses.push('Гладиатор: +10% блок');
            }
            if (count >= 4) {
                st = scaleKeep(st, 1.1);
                setBonuses.push('Гладиатор: +10% ко всем статам');
            }
        }
        else if (set === 'Отшельник' || set === 'hermit') {
            if (count >= 2) {
                st.hermitRegen = true;
                setBonuses.push('Отшельник: +100% реген HP (вне боя)');
            }
            if (count >= 3) {
                st.poisonOnHit = 3;
                setBonuses.push('Отшельник: яд 3% HP на 3 хода');
            }
            if (count >= 4) {
                extra.dodge = Math.round(extra.dodge * 1.15);
                setBonuses.push('Отшельник: +15% уклонение');
            }
        }
    }
    st.setBonuses = setBonuses;
    // --- Артефакты ---
    for (const item of Object.values(equipment)) {
        const effect = item.extra?.effect;
        if (!effect)
            continue;
        if (effect === 'vampirism') {
            st.vampirism = (st.vampirism || 0) + 5;
        }
        else if (effect === 'rage') {
            st.rageDmg = (st.rageDmg || 0) + 20;
            st.rageThreshold = Math.min(st.rageThreshold || 1, 0.3);
        }
        else if (effect === 'luck') {
            st.luckBoost = 5;
        }
        else if (effect === 'resilience') {
            st.resiliencePct = 30;
        }
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
function isSlotCompatible(slotId, item) {
    if (!item)
        return false;
    const itemSlot = item.slot;
    if (itemSlot === 'ring' || itemSlot === 'ring1' || itemSlot === 'ring2')
        return slotId === 'ring1' || slotId === 'ring2';
    if (itemSlot === 'weapon1')
        return slotId === 'weapon1';
    if (itemSlot === 'shield')
        return slotId === 'shield';
    return itemSlot === slotId;
}
//# sourceMappingURL=stats.js.map