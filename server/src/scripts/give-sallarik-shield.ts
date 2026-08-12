import { db } from '../db/index';
import { addToOverflow } from '../routes/overflow';

async function main() {
    const uid = 131;

    const shield = {
        id: Date.now() + Math.random(),
        name: 'Башенный щит',
        slot: 'shield',
        rarity_id: 6,
        rarity_display: 'Мифический',
        rarity_color: '#e74c3c',
        bonuses: { s: 23, a: 0, d: 0, m: 0 },
        extra: {
            set: 'Страж',
            crit: 0, dodge: 0, counter: 0, fullBlock: 24,
            setBonus2: '+10% блок',
            setBonus3: '+15% защита',
            setBonus4: 'Ответный удар 30% шанс'
        },
        upgradeLevel: 8,
        image: 'shield/shield_white.webp'
    };

    await addToOverflow(uid, shield);
    console.log('OK: Башенный щит +8 → склад Sallarik');
}

main().catch(err => { console.error(err); process.exit(1); });
