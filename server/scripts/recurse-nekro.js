"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
const CURSE_RANKS = [
    { rank: 1, name: 'I', color: '#22c55e', min: 10, max: 20, weight: 160 },
    { rank: 2, name: 'II', color: '#3b82f6', min: 20, max: 30, weight: 24 },
    { rank: 3, name: 'III', color: '#a855f7', min: 30, max: 40, weight: 12 },
    { rank: 4, name: 'IV', color: '#f97316', min: 40, max: 50, weight: 3 },
    { rank: 5, name: 'V', color: '#ef4444', min: 50, max: 60, weight: 1 },
];
function rollCurse() {
    const totalWeight = CURSE_RANKS.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * totalWeight;
    let rank = CURSE_RANKS[0];
    for (const r of CURSE_RANKS) {
        roll -= r.weight;
        if (roll <= 0) {
            rank = r;
            break;
        }
    }
    const stats = ['s', 'm']; // only S and M
    const stat = stats[Math.floor(Math.random() * 2)];
    const value = Math.floor(Math.random() * (rank.max - rank.min + 1)) + rank.min;
    return { rank: rank.rank, name: rank.name, color: rank.color, stat, value };
}
async function main() {
    const uid = 1;
    const user = await index_1.db.one('SELECT equipment FROM users WHERE id = ?', [uid]);
    const equipment = JSON.parse(user.equipment || '{}');
    for (const [slot, item] of Object.entries(equipment)) {
        const curse = rollCurse();
        item.curseStat = curse.stat;
        item.curseValue = curse.value;
        item.curseRank = curse.rank;
        item.curseName = curse.name;
        item.curseColor = curse.color;
        const statName = curse.stat === 's' ? 'Сила' : 'Мастерство';
        console.log(`${slot}: ${item.name} → +${curse.value} ${statName} (ранг ${curse.name})`);
    }
    await index_1.db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), uid]);
    console.log('Готово.');
}
main().catch(err => { console.error(err); process.exit(1); });
//# sourceMappingURL=recurse-nekro.js.map