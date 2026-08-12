import { db } from '../db/index';
import { addToOverflow } from '../routes/overflow';

async function main() {
    const uid = 692;

    // Гребень бури + curse rank III на мастерство
    const curseValue = Math.floor(Math.random() * (40 - 30 + 1)) + 30;
    const helmet = {
        id: Date.now() + Math.random(),
        name: 'Гребень бури',
        slot: 'helmet',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        bonuses: { s: 0, a: 26, d: 0, m: 20 },
        extra: {
            set: 'Буревестник',
            crit: 0, dodge: 0, counter: 0, fullBlock: 0,
            setBonus2: '+10% ловкость',
            setBonus3: 'Первый ход всегда твой',
            setBonus4: '+20% уклонение'
        },
        upgradeLevel: 0,
        image: 'helmet/helmet_yellow.webp',
        curseStat: 'm',
        curseValue,
        curseRank: 3,
        curseName: 'III',
        curseColor: '#a855f7'
    };

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

    await addToOverflow(uid, helmet);
    console.log(`OK: Гребень бури +0, curse m+${curseValue} (III)`);

    await addToOverflow(uid, crystal);
    console.log('OK: 2x Кристалл душ');

    await db.run('UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + 200000 WHERE id = ?', [uid]);
    console.log('OK: +200,000 на склад');

    const u = await db.one('SELECT overflowmoney FROM users WHERE id = ?', [uid]) as any;
    const items = await db.query('SELECT COUNT(*) as cnt FROM overflow_storage WHERE userid = ?', [uid]) as any[];
    console.log(`Склад: ${items[0]?.cnt || 0} предметов, ${u?.overflowmoney || 0} серебра`);
}

main().catch(err => { console.error(err); process.exit(1); });
