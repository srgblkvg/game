import { db } from '../db/index';
import { addToOverflow } from '../routes/overflow';

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

    await addToOverflow(uid, shield);
    console.log('OK: Дробящий щит +6');

    await addToOverflow(uid, crystal);
    console.log('OK: 20x Кристалл душ');

    const items = await db.query('SELECT COUNT(*) as cnt FROM overflow_storage WHERE userid = ?', [uid]) as any[];
    console.log(`Склад: ${items[0]?.cnt || 0} предметов`);
}

main().catch(err => { console.error(err); process.exit(1); });
