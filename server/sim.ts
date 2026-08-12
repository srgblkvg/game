// Симуляция боёв Некрохирург (сет 3) vs Sallarik
import { db } from './src/db/index';
import { runBattle } from './src/game/battle';
import { getCollectionBonus } from './src/db/helpers';

async function main() {
    const u1 = await db.one('SELECT * FROM users WHERE id = 1');
    const u2 = await db.one('SELECT * FROM users WHERE id = 131');

    const eq3 = typeof u1.equipment_3 === 'string' ? JSON.parse(u1.equipment_3) : u1.equipment_3;
    const eq2 = typeof u2.equipment === 'string' ? JSON.parse(u2.equipment) : u2.equipment;

    const cb1 = await getCollectionBonus(1);
    const cb2 = await getCollectionBonus(131);

    let drink1 = null, drink2 = null;
    if (u1.activedrink) { try { const d = JSON.parse(u1.activedrink); if (d.bonuses) drink1 = d.bonuses; } catch {} }
    if (u2.activedrink) { try { const d = JSON.parse(u2.activedrink); if (d.bonuses) drink2 = d.bonuses; } catch {} }

    const base1 = { s: +u1.bases, a: +u1.basea, d: +u1.based, m: +u1.basem };
    const base2 = { s: +u2.bases, a: +u2.basea, d: +u2.based, m: +u2.basem };

    let wins1 = 0, wins2 = 0;
    const N = 100;

    for (let i = 0; i < N; i++) {
        const result = runBattle(
            { id: 1, name: 'Некрохирург', base: base1, equipment: eq3, level: +u1.level, money: u1.money || 0, drinkBonuses: drink1, collectionBonus: cb1 },
            { id: 131, name: 'Sallarik', base: base2, equipment: eq2, level: +u2.level, money: u2.money || 0, drinkBonuses: drink2, collectionBonus: cb2 }
        );
        if (result.winnerId === 1) wins1++; else wins2++;
    }

    console.log(`Некрохирург (сет 3): ${wins1} (${(wins1/N*100).toFixed(1)}%)`);
    console.log(`Sallarik: ${wins2} (${(wins2/N*100).toFixed(1)}%)`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
