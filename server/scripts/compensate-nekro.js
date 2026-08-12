"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../db/index");
const overflow_1 = require("../routes/overflow");
async function main() {
    const uid = 1;
    const shield = {
        id: Date.now() + Math.random(),
        name: 'Дробящий щит',
        slot: 'shield',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 22 },
        extra: {
            set: 'Крушитель',
            crit: 0, dodge: 0, counter: 0, fullBlock: 22,
            setBonus2: '+25% пробивание блока',
            setBonus3: '+10% крит',
            setBonus4: '+15% урон'
        },
        upgradeLevel: 6,
        image: 'shield/shield_gray.webp'
    };
    const crystal = {
        id: 23,
        name: 'Кристалл душ',
        type: 'craft_item',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        count: 20,
        itemType: 'soul_crystal',
        image: '/uploads/admin/craft/1785150034070_yyqrol.webp'
    };
    await (0, overflow_1.addToOverflow)(uid, shield);
    console.log('OK: Дробящий щит +6');
    await (0, overflow_1.addToOverflow)(uid, crystal);
    console.log('OK: 20x Кристалл душ');
    const items = await index_1.db.query('SELECT COUNT(*) as cnt FROM overflow_storage WHERE userid = ?', [uid]);
    console.log(`Склад: ${items[0]?.cnt || 0} предметов`);
}
main().catch(err => { console.error(err); process.exit(1); });
//# sourceMappingURL=compensate-nekro.js.map