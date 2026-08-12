import { db } from '../db/index';
import { addToOverflow } from '../routes/overflow';

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
    let rank = CURSE_RANKS[0]!;
    for (const r of CURSE_RANKS) {
        roll -= r.weight;
        if (roll <= 0) { rank = r; break; }
    }
    const stats = ['s', 'm'];
    const stat = stats[Math.floor(Math.random() * 2)]!;
    const value = Math.floor(Math.random() * (rank.max - rank.min + 1)) + rank.min;
    return { rank: rank.rank, name: rank.name, color: rank.color, stat, value };
}

async function main() {
    const uid = 693;
    const curse = rollCurse();

    const gloves = {
        id: Date.now() + Math.random(),
        name: 'Перчатки жнеца',
        slot: 'gloves',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        bonuses: { s: 24, a: 21, d: 0, m: 0 },
        extra: {
            set: 'Жнец',
            crit: 0, dodge: 0, counter: 0, fullBlock: 0,
            setBonus2: '+5% вампиризм',
            setBonus3: '+15% урон',
            setBonus4: 'Добивание <10% HP'
        },
        upgradeLevel: 6,
        image: 'gloves/gloves_red.webp',
        curseStat: curse.stat,
        curseValue: curse.value,
        curseRank: curse.rank,
        curseName: curse.name,
        curseColor: curse.color
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

    await addToOverflow(uid, gloves);
    const statName = curse.stat === 's' ? 'Сила' : 'Мастерство';
    console.log(`OK: Перчатки жнеца +6, curse ${statName}+${curse.value} (ранг ${curse.name})`);

    await addToOverflow(uid, crystal);
    console.log('OK: 2x Кристалл душ');

    await db.run('UPDATE users SET overflowmoney = COALESCE(overflowmoney, 0) + 100000 WHERE id = ?', [uid]);
    console.log('OK: +100,000 на склад');

    const u = await db.one('SELECT overflowmoney FROM users WHERE id = ?', [uid]) as any;
    const items = await db.query('SELECT COUNT(*) as cnt FROM overflow_storage WHERE userid = ?', [uid]) as any[];
    console.log(`Склад: ${items[0]?.cnt || 0} предметов, ${u?.overflowmoney || 0} серебра`);
}

main().catch(err => { console.error(err); process.exit(1); });
