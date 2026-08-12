"use strict";
// Создаёт сборку "Контр-убийца" (Буревестник 4 + Гладиатор 4 + Дуэлянт 2) для Некрохирурга (id=1)
// Все предметы upgradeLevel=6, rarity=6 (мифический), curse ранг 3-5 на A или M
// Кладёт на overflow_storage
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
// Helpers
const now = () => Date.now();
const curseRank = (r) => {
    const names = ['I', 'II', 'III', 'IV', 'V'];
    const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444'];
    return { rank: r, name: names[r - 1], color: colors[r - 1] };
};
// Curse value range per rank
const curseRange = (rank) => {
    const ranges = {
        3: [30, 40],
        4: [40, 50],
        5: [50, 60],
    };
    const [min, max] = ranges[rank] || [30, 40];
    return min + Math.floor(Math.random() * (max - min + 1));
};
async function main() {
    const userId = 1;
    // Очищаем старый overflow Некрохирурга
    await index_1.db.run('DELETE FROM overflow_storage WHERE userid = ?', [userId]);
    console.log('Старый overflow очищен');
    const items = [];
    // === БУРЕВЕСТНИК 4/4 ===
    // Шлем
    items.push({
        id: now() + 1, name: 'Гребень бури', slot: 'helmet', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 26, d: 0, m: 20 },
        extra: { set: 'Буревестник', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        image: 'helmet/helmet_yellow.webp', upgradeLevel: 6,
        curseStat: 'a', curseValue: curseRange(4), curseRank: 4, curseName: 'IV', curseColor: '#f97316',
    });
    // Перчатки
    items.push({
        id: now() + 2, name: 'Перчатки ветров', slot: 'gloves', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 27, d: 0, m: 19 },
        extra: { set: 'Буревестник', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        image: 'gloves/gloves_yellow.webp', upgradeLevel: 6,
        curseStat: 'm', curseValue: curseRange(3), curseRank: 3, curseName: 'III', curseColor: '#a855f7',
    });
    // Амулет
    items.push({
        id: now() + 3, name: 'Амулет молнии', slot: 'amulet', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { set: 'Буревестник', crit: 0, dodge: 23, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        image: 'amulet/amulet_yellow.webp', upgradeLevel: 6,
        curseStat: 'a', curseValue: curseRange(5), curseRank: 5, curseName: 'V', curseColor: '#ef4444',
    });
    // Сапоги
    items.push({
        id: now() + 4, name: 'Сапоги урагана', slot: 'boots', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 22, a: 24, d: 0, m: 0 },
        extra: { set: 'Буревестник', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% ловкость', setBonus3: 'Первый ход всегда твой', setBonus4: '+20% уклонение' },
        image: 'boots/boots_yellow.webp', upgradeLevel: 6,
        curseStat: 'm', curseValue: curseRange(4), curseRank: 4, curseName: 'IV', curseColor: '#f97316',
    });
    // === ГЛАДИАТОР 4/4 ===
    // Оружие
    items.push({
        id: now() + 5, name: 'Гладиус чемпиона', slot: 'weapon1', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 28, a: 21, d: 0, m: 0 },
        extra: { set: 'Гладиатор', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+15% урон +15% контратака', setBonus3: '+10% блок', setBonus4: '+10% ко всем статам' },
        image: 'sword/sword_yellow.webp', upgradeLevel: 6,
        curseStat: 'a', curseValue: curseRange(5), curseRank: 5, curseName: 'V', curseColor: '#ef4444',
    });
    // Щит
    items.push({
        id: now() + 6, name: 'Парадный кинжал', slot: 'shield', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 24, d: 0, m: 20 },
        extra: { set: 'Гладиатор', crit: 0, dodge: 0, counter: 0, fullBlock: 18, setBonus2: '+15% урон +15% контратака', setBonus3: '+10% блок', setBonus4: '+10% ко всем статам' },
        image: 'shield/shield_yellow.webp', upgradeLevel: 6,
        curseStat: 'm', curseValue: curseRange(5), curseRank: 5, curseName: 'V', curseColor: '#ef4444',
    });
    // Кираса
    items.push({
        id: now() + 7, name: 'Кираса чемпиона', slot: 'chest', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 27, m: 20 },
        extra: { set: 'Гладиатор', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+15% урон +15% контратака', setBonus3: '+10% блок', setBonus4: '+10% ко всем статам' },
        image: 'chest/chest_yellow.webp', upgradeLevel: 6,
        curseStat: 'a', curseValue: curseRange(4), curseRank: 4, curseName: 'IV', curseColor: '#f97316',
    });
    // Пояс
    items.push({
        id: now() + 8, name: 'Пояс чемпиона', slot: 'belt', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { set: 'Гладиатор', crit: 22, dodge: 0, counter: 19, fullBlock: 0, setBonus2: '+15% урон +15% контратака', setBonus3: '+10% блок', setBonus4: '+10% ко всем статам' },
        image: 'belt/belt_yellow.webp', upgradeLevel: 6,
        curseStat: 'm', curseValue: curseRange(3), curseRank: 3, curseName: 'III', curseColor: '#a855f7',
    });
    // === ДУЭЛЯНТ 2/4 ===
    // Кольцо 1
    items.push({
        id: now() + 9, name: 'Печать дуэлянта', slot: 'ring', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { set: 'Дуэлянт', crit: 21, dodge: 0, counter: 22, fullBlock: 0, setBonus2: '+10% контратака', setBonus3: '+15% крит', setBonus4: 'Крит восстанавливает 5% HP' },
        image: 'ring/ring_blue.webp', upgradeLevel: 6,
        curseStat: 'a', curseValue: curseRange(3), curseRank: 3, curseName: 'III', curseColor: '#a855f7',
    });
    // Кольцо 2
    items.push({
        id: now() + 10, name: 'Амулет фехтовальщика', slot: 'ring', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: { set: 'Дуэлянт', crit: 23, dodge: 0, counter: 18, fullBlock: 0, setBonus2: '+10% контратака', setBonus3: '+15% крит', setBonus4: 'Крит восстанавливает 5% HP' },
        image: 'ring/ring_blue.webp', upgradeLevel: 6,
        curseStat: 'm', curseValue: curseRange(4), curseRank: 4, curseName: 'IV', curseColor: '#f97316',
    });
    // Вставляем в overflow
    for (const item of items) {
        await index_1.db.run('INSERT INTO overflow_storage (userid, item, createdat) VALUES (?, ?, ?)', [userId, JSON.stringify(item), Math.floor(Date.now() / 1000)]);
        console.log(`+ ${item.name} [${item.slot}] curse ${item.curseName} +${item.curseValue}${item.curseStat}`);
    }
    console.log(`\nГотово: ${items.length} предметов в overflow для Некрохирурга`);
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=give-counter-build.js.map