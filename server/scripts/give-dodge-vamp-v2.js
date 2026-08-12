"use strict";
// Dodge-вампир v2: Буревестник 4 + Гладиатор 2 + артефакты (Подкова, Кольцо вампира, Кольцо травника)
// Некрохирург (id=1). upgradeLevel=6, curse ранг 3-5 на M
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
const now = () => Date.now() + Math.floor(Math.random() * 10000);
function curseM(rank) {
    const ranges = { 3: [30, 40], 4: [40, 50], 5: [50, 60] };
    const [min, max] = ranges[rank] || [30, 40];
    const value = min + Math.floor(Math.random() * (max - min + 1));
    const names = ['I', 'II', 'III', 'IV', 'V'];
    const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444'];
    return { curseStat: 'm', curseValue: value, curseRank: rank, curseName: names[rank - 1], curseColor: colors[rank - 1] };
}
const items = [
    // Буревестник 4
    { id: now(), name: 'Гребень бури', slot: 'helmet', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 26, d: 0, m: 20 }, image: 'helmet/helmet_yellow.webp',
        extra: { set: 'Буревестник', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        curse: curseM(4) },
    { id: now(), name: 'Перчатки ветров', slot: 'gloves', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 27, d: 0, m: 19 }, image: 'gloves/gloves_yellow.webp',
        extra: { set: 'Буревестник', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        curse: curseM(3) },
    { id: now(), name: 'Амулет молнии', slot: 'amulet', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'amulet/amulet_yellow.webp',
        extra: { set: 'Буревестник', crit: 0, dodge: 23, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        curse: curseM(5) },
    { id: now(), name: 'Сапоги урагана', slot: 'boots', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 22, a: 24, d: 0, m: 0 }, image: 'boots/boots_yellow.webp',
        extra: { set: 'Буревестник', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        curse: curseM(5) },
    // Гладиатор 2
    { id: now(), name: 'Гладиус чемпиона', slot: 'weapon1', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 26, a: 21, d: 0, m: 0 }, image: 'sword/sword_yellow.webp',
        extra: { set: 'Гладиатор', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+15% урон +15% контратака', setBonus3: '+10% блок', setBonus4: '+10% ко всем статам' },
        curse: curseM(5) },
    { id: now(), name: 'Скутум гладиатора', slot: 'shield', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 24, a: 0, d: 0, m: 0 }, image: 'shield/shield_yellow.webp',
        extra: { set: 'Гладиатор', crit: 0, dodge: 0, counter: 0, fullBlock: 21, setBonus2: '+15% урон +15% контратака', setBonus3: '+10% блок', setBonus4: '+10% ко всем статам' },
        curse: curseM(4) },
    // Остальное
    { id: now(), name: 'Багровый доспех', slot: 'chest', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 25, a: 0, d: 22, m: 0 }, image: 'chest/chest_red.webp',
        extra: { set: 'Жнец', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+5% вампиризм', setBonus3: '+15% урон', setBonus4: 'Добивание <10% HP' },
        curse: curseM(4) },
    // Артефакты
    { id: now(), name: 'Подкова удачи', slot: 'belt', rarity_id: 7, rarity_display: 'Артефакт', rarity_color: '#ff4444',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'belt/belt_green.webp',
        extra: { crit: 15, dodge: 15, effect: 'luck', counter: 10, fullBlock: 0, effectDesc: '+5% ко всем шансам', effectValue: 5 },
        curse: curseM(3) },
    { id: now(), name: 'Кольцо вампира', slot: 'ring', rarity_id: 7, rarity_display: 'Артефакт', rarity_color: '#ff4444',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'ring/ring_red.webp',
        extra: { crit: 22, dodge: 0, effect: 'vampirism', counter: 18, fullBlock: 0, effectDesc: '5% вампиризм', effectValue: 5 },
        curse: curseM(4) },
    { id: now(), name: 'Кольцо травника', slot: 'ring', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'ring/ring_green.webp',
        extra: { set: 'Отшельник', crit: 0, dodge: 22, counter: 0, fullBlock: 19, setBonus2: '+100% реген HP (вне боя)', setBonus3: 'Яд на атаку 3% HP 3 хода', setBonus4: '+15% уклонение' },
        curse: curseM(3) },
];
async function main() {
    const userId = 1;
    await index_1.db.run('DELETE FROM overflow_storage WHERE userid = ?', [userId]);
    console.log('Старый overflow очищен\n');
    for (const it of items) {
        const c = it.curse;
        const item = {
            id: it.id, name: it.name, slot: it.slot,
            rarity_id: it.rarity_id, rarity_display: it.rarity_display, rarity_color: it.rarity_color,
            bonuses: it.bonuses, extra: it.extra, image: it.image, upgradeLevel: 6,
            curseStat: c.curseStat, curseValue: c.curseValue, curseRank: c.curseRank,
            curseName: c.curseName, curseColor: c.curseColor,
        };
        await index_1.db.run('INSERT INTO overflow_storage (userid, item, createdat) VALUES (?, ?, ?)', [userId, JSON.stringify(item), Math.floor(Date.now() / 1000)]);
        console.log(`+ ${it.name.padEnd(20)} [${it.slot.padEnd(8)}] curse ${c.curseName} +${c.curseValue} M`);
    }
    console.log(`\nГотово: ${items.length} предметов`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=give-dodge-vamp-v2.js.map