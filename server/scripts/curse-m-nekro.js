"use strict";
// @ts-nocheck
// Обновить curse в слоте I Некрохирурга: M, ранг 2-4
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
const names = ['I', 'II', 'III', 'IV', 'V'];
const colors = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ef4444'];
function curseM(rank) {
    const ranges = { 2: [20, 30], 3: [30, 40], 4: [40, 50] };
    const range = ranges[rank] || [20, 30];
    const [min, max] = range;
    const value = min + Math.floor(Math.random() * (max - min + 1));
    return { curseStat: 'm', curseValue: value, curseRank: rank, curseName: names[rank - 1], curseColor: colors[rank - 1] };
}
function randomRank() {
    return [2, 2, 2, 3, 3, 4][Math.floor(Math.random() * 6)];
}
async function main() {
    const userId = 1;
    const user = await index_1.db.one('SELECT equipment, equipment_1 FROM users WHERE id = ?', [userId]);
    const eq1 = typeof user.equipment_1 === 'string' ? JSON.parse(user.equipment_1) : user.equipment_1;
    console.log('Слот I — curse M 2-4:');
    for (const key of Object.keys(eq1)) {
        const item = eq1[key];
        const c = curseM(randomRank());
        item.curseStat = c.curseStat;
        item.curseValue = c.curseValue;
        item.curseRank = c.curseRank;
        item.curseName = c.curseName;
        item.curseColor = c.curseColor;
        console.log(`  ${item.name.padEnd(20)} ${c.curseName} +${c.curseValue} M`);
    }
    const eqStr = JSON.stringify(eq1);
    await index_1.db.run('UPDATE users SET equipment = ?, equipment_1 = ?::jsonb WHERE id = ?', [eqStr, eqStr, userId]);
    console.log('\nГотово.');
    process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=curse-m-nekro.js.map