/**
 * Компенсация Хорсу (uid=461): Амулет молний +6, 2x Кристалл душ, 100k на склад
 */
import { db } from '../db/index';
import { addToOverflow } from '../routes/overflow';

async function main() {
    const uid = 461;

    // Амулет молний +6
    const amulet = {
        id: Date.now() + Math.random(),
        name: 'Амулет молнии',
        slot: 'amulet',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 0, d: 0, m: 0 },
        extra: {
            set: 'Буревестник',
            crit: 0, dodge: 23, counter: 0, fullBlock: 0,
            setBonus2: '+10% ловкость',
            setBonus3: 'Первый ход всегда твой',
            setBonus4: '+20% уклонение'
        },
        upgradeLevel: 6,
        image: 'amulet/amulet_yellow.webp'
    };

    // 2x Кристалл душ
    const crystal = {
        id: 23,
        name: 'Кристалл душ',
        type: 'craft_item',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        count: 2,
        itemType: 'soul_crystal',
        image: '/uploads/admin/craft/1785150034070_yyqrol.webp'
    };

    await addToOverflow(uid, amulet);
    console.log('OK: Амулет молний +6');

    await addToOverflow(uid, crystal);
    console.log('OK: 2x Кристалл душ');

    await db.run('UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + 100000 WHERE id = ?', [uid]);
    console.log('OK: +100,000 серебра на склад');

    const user = await db.one('SELECT overflowmoney FROM users WHERE id = ?', [uid]) as any;
    const items = await db.query('SELECT COUNT(*) as cnt FROM overflow_storage WHERE userid = ?', [uid]) as any[];
    console.log(`Склад: ${items[0]?.cnt || 0} предметов, ${user?.overflowmoney || 0} серебра`);
}

main().catch(err => { console.error(err); process.exit(1); });
