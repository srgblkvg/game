"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Сброс проклятий 4-5 ранга (полученных бесплатными перебросами)
 * на рандомные 1-3 ранг той же характеристики.
 * Компенсация: 5x Кристалл душ + 500k на склад.
 */
const index_1 = require("../db/index");
const overflow_1 = require("../routes/overflow");
const CURSE_RANKS_1_3 = [
    { rank: 1, name: 'I', color: '#22c55e', min: 10, max: 20, weight: 160 },
    { rank: 2, name: 'II', color: '#3b82f6', min: 20, max: 30, weight: 24 },
    { rank: 3, name: 'III', color: '#a855f7', min: 30, max: 40, weight: 12 },
];
function rollCurse(stat) {
    const totalWeight = CURSE_RANKS_1_3.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * totalWeight;
    let rank = CURSE_RANKS_1_3[0];
    for (const r of CURSE_RANKS_1_3) {
        roll -= r.weight;
        if (roll <= 0) {
            rank = r;
            break;
        }
    }
    const value = Math.floor(Math.random() * (rank.max - rank.min + 1)) + rank.min;
    return { rank: rank.rank, name: rank.name, color: rank.color, stat, value };
}
async function main() {
    const users = await index_1.db.query('SELECT id, inventory, equipment FROM users');
    const affectedUsers = new Set();
    const log = [];
    for (const user of users) {
        const uid = user.id;
        let inventory;
        try {
            inventory = JSON.parse(user.inventory || '[]');
        }
        catch {
            continue;
        }
        let equipment;
        try {
            equipment = JSON.parse(user.equipment || '{}');
        }
        catch {
            continue;
        }
        let changed = false;
        // Проверяем инвентарь
        for (const item of inventory) {
            if (item.curseRank === 4 || item.curseRank === 5) {
                const oldStat = item.curseStat;
                const oldRank = item.curseRank;
                const curse = rollCurse(oldStat);
                item.curseRank = curse.rank;
                item.curseName = curse.name;
                item.curseColor = curse.color;
                item.curseValue = curse.value;
                item.curseStat = curse.stat;
                changed = true;
                log.push(`uid=${uid} inv: ${item.name} curse ${oldStat}+${item.curseValue} (ранг ${oldStat === item.curseStat ? '' : 'стат '}${oldRank}→${curse.rank})`);
            }
        }
        // Проверяем экипировку
        for (const [slot, item] of Object.entries(equipment)) {
            if (item.curseRank === 4 || item.curseRank === 5) {
                const oldStat = item.curseStat;
                const oldRank = item.curseRank;
                const curse = rollCurse(oldStat);
                item.curseRank = curse.rank;
                item.curseName = curse.name;
                item.curseColor = curse.color;
                item.curseValue = curse.value;
                item.curseStat = curse.stat;
                changed = true;
                log.push(`uid=${uid} eq: ${item.name} curse ${oldStat}+${item.curseValue} (ранг ${oldRank}→${curse.rank})`);
            }
        }
        if (changed) {
            await index_1.db.run('UPDATE users SET inventory = ?, equipment = ? WHERE id = ?', [JSON.stringify(inventory), JSON.stringify(equipment), uid]);
            affectedUsers.add(uid);
        }
    }
    // Компенсация
    for (const uid of affectedUsers) {
        const crystal = {
            id: 23, name: 'Кристалл душ', type: 'craft_item',
            rarity_id: 6, rarity_display: 'Мифический', rarity_color: '#e74c3c',
            count: 5, itemType: 'soul_crystal',
            image: '/uploads/admin/craft/1785150034070_yyqrol.webp'
        };
        await (0, overflow_1.addToOverflow)(uid, crystal);
        await index_1.db.run('UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + 500000 WHERE id = ?', [uid]);
        console.log(`uid=${uid}: +5 Кристалл душ +500k на склад`);
    }
    console.log('\nСброшено проклятий:');
    for (const l of log)
        console.log('  ' + l);
    console.log(`\nЗатронуто пользователей: ${affectedUsers.size}`);
}
main().catch(err => { console.error(err); process.exit(1); });
//# sourceMappingURL=reset-high-curses.js.map