"use strict";
// @ts-nocheck
// Обновить текущий сет Некрохирурга: curse ранг 2-4 на S
// + Создать Жнец-убийца (Жнец 4 + Страж 4 + Берсерк 2) в слот 2, curse 2-4 S
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
const names = ['I', 'II', 'III', 'IV', 'V'];
const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444'];
function curseS(rank) {
    const ranges = { 2: [20, 30], 3: [30, 40], 4: [40, 50] };
    const range = ranges[rank] || [20, 30];
    const [min, max] = range;
    const value = min + Math.floor(Math.random() * (max - min + 1));
    return { curseStat: 's', curseValue: value, curseRank: rank, curseName: names[rank - 1], curseColor: colors[rank - 1] };
}
function randomRank() {
    return [2, 2, 2, 3, 3, 4][Math.floor(Math.random() * 6)]; // 50% rank 2, 33% rank 3, 17% rank 4
}
async function main() {
    const userId = 1;
    const user = await index_1.db.one('SELECT equipment, equipment_1, equipment_2, equipment_3 FROM users WHERE id = ?', [userId]);
    // === Обновляем текущий сет (слот 1) ===
    const eq1 = typeof user.equipment_1 === 'string' ? JSON.parse(user.equipment_1) : user.equipment_1;
    let changed = false;
    for (const key of Object.keys(eq1)) {
        const item = eq1[key];
        const c = curseS(randomRank());
        item.curseStat = c.curseStat;
        item.curseValue = c.curseValue;
        item.curseRank = c.curseRank;
        item.curseName = c.curseName;
        item.curseColor = c.curseColor;
        changed = true;
        console.log(`  ${item.name.padEnd(20)} [${item.slot}] curse ${c.curseName} +${c.curseValue} S`);
    }
    if (changed) {
        const eqStr = JSON.stringify(eq1);
        await index_1.db.run('UPDATE users SET equipment = ?, equipment_1 = ?::jsonb WHERE id = ?', [eqStr, eqStr, userId]);
        console.log('Слот I обновлён\n');
    }
    // === Создаём Жнец-убийца (слот 2) ===
    await index_1.db.run('DELETE FROM overflow_storage WHERE userid = ?', [userId]);
    const now = () => Date.now() + Math.floor(Math.random() * 10000);
    const set2 = {};
    // Жнец 4/4
    set2.weapon1 = { id: now(), name: 'Коса жнеца', slot: 'weapon1', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 28, a: 0, d: 21, m: 0 }, image: 'sword/sword_red.webp', upgradeLevel: 6,
        extra: { set: 'Жнец', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+5% вампиризм', setBonus3: '+15% урон', setBonus4: 'Добивание <10% HP' },
        ...curseS(randomRank()) };
    set2.chest = { id: now(), name: 'Багровый доспех', slot: 'chest', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 25, a: 0, d: 22, m: 0 }, image: 'chest/chest_red.webp', upgradeLevel: 6,
        extra: { set: 'Жнец', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+5% вампиризм', setBonus3: '+15% урон', setBonus4: 'Добивание <10% HP' },
        ...curseS(randomRank()) };
    set2.gloves = { id: now(), name: 'Перчатки жнеца', slot: 'gloves', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 24, a: 21, d: 0, m: 0 }, image: 'gloves/gloves_red.webp', upgradeLevel: 6,
        extra: { set: 'Жнец', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+5% вампиризм', setBonus3: '+15% урон', setBonus4: 'Добивание <10% HP' },
        ...curseS(randomRank()) };
    set2.belt = { id: now(), name: 'Пояс смерти', slot: 'belt', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'belt/belt_red.webp', upgradeLevel: 6,
        extra: { set: 'Жнец', crit: 24, dodge: 0, counter: 0, fullBlock: 18, setBonus2: '+5% вампиризм', setBonus3: '+15% урон', setBonus4: 'Добивание <10% HP' },
        ...curseS(randomRank()) };
    // Страж 4/4
    set2.helmet = { id: now(), name: 'Шлем стража', slot: 'helmet', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 26, m: 19 }, image: 'helmet/helmet_white.webp', upgradeLevel: 6,
        extra: { set: 'Страж', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% блок', setBonus3: '+15% защита', setBonus4: 'Ответный удар 30% шанс' },
        ...curseS(randomRank()) };
    set2.shield = { id: now(), name: 'Башенный щит', slot: 'shield', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 23, a: 0, d: 0, m: 0 }, image: 'shield/shield_white.webp', upgradeLevel: 6,
        extra: { set: 'Страж', crit: 0, dodge: 0, counter: 0, fullBlock: 24, setBonus2: '+10% блок', setBonus3: '+15% защита', setBonus4: 'Ответный удар 30% шанс' },
        ...curseS(randomRank()) };
    set2.ring1 = { id: now(), name: 'Кольцо оплота', slot: 'ring', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'ring/ring_white.webp', upgradeLevel: 6,
        extra: { set: 'Страж', crit: 0, dodge: 0, counter: 0, fullBlock: 23, setBonus2: '+10% блок', setBonus3: '+15% защита', setBonus4: 'Ответный удар 30% шанс' },
        ...curseS(randomRank()) };
    // Страж 4/4 ring2 — используем Кольцо вампира (артефакт)
    set2.ring2 = { id: now(), name: 'Кольцо вампира', slot: 'ring', rarity_id: 7, rarity_display: 'Артефакт', rarity_color: '#ff4444',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'ring/ring_red.webp', upgradeLevel: 6,
        extra: { crit: 22, dodge: 0, effect: 'vampirism', counter: 18, fullBlock: 0, effectDesc: '5% вампиризм', effectValue: 5 },
        ...curseS(randomRank()) };
    // Берсерк 2/4 (boots + amulet)
    set2.boots = { id: now(), name: 'Сапоги неистовства', slot: 'boots', rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
        bonuses: { s: 24, a: 0, d: 22, m: 0 }, image: 'boots/boots_red.webp', upgradeLevel: 6,
        extra: { set: 'Берсерк', crit: 0, dodge: 0, counter: 0, fullBlock: 0, setBonus2: '+10% урон', setBonus3: '+20% урон при HP<50%', setBonus4: 'Игнор 20% брони' },
        ...curseS(randomRank()) };
    set2.amulet = { id: now(), name: 'Талисман стойкости', slot: 'amulet', rarity_id: 7, rarity_display: 'Артефакт', rarity_color: '#ff4444',
        bonuses: { s: 0, a: 0, d: 0, m: 0 }, image: 'amulet/amulet_white.webp', upgradeLevel: 6,
        extra: { crit: 0, dodge: 0, effect: 'resilience', counter: 0, fullBlock: 22, effectDesc: '-30% длительность яда / -30% шанс быть оглушенным', effectValue: 30 },
        ...curseS(randomRank()) };
    // Сохраняем в слот 2
    await index_1.db.run('UPDATE users SET equipment_2 = ?::jsonb WHERE id = ?', [JSON.stringify(set2), userId]);
    console.log('Слот II (Жнец-убийца):');
    for (const key of Object.keys(set2)) {
        const item = set2[key];
        console.log(`  + ${item.name.padEnd(20)} [${item.slot}] curse ${item.curseName} +${item.curseValue} S`);
    }
    console.log('\nГотово. Ctrl+Shift+R для обновления.');
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=recurse-nekro-v2.js.map