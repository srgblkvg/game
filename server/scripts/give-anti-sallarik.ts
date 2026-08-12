// @ts-nocheck
// Анти-Салларик: Буревестник 4 + Гладиатор 2 + Подкова + вампир + dodge 24
// Слот 3, curse A 2-4

import { db } from '../db/index';

const names = ['I','II','III','IV','V'];
const colors = ['#22c55e','#3b82f6','#a855f7','#f97316','#ef4444'];
const now = () => Date.now() + Math.floor(Math.random() * 10000);

function curseA(rank: number) {
    const ranges: Record<number, [number, number]> = { 2: [20,30], 3: [30,40], 4: [40,50] };
    const range = ranges[rank] || [20,30] as [number, number];
    const [min, max] = range;
    const value = min + Math.floor(Math.random() * (max - min + 1));
    return { curseStat:'a', curseValue:value, curseRank:rank, curseName:names[rank-1]!, curseColor:colors[rank-1]! };
}

function randomRank(): number {
    return [2,2,2,3,3,4][Math.floor(Math.random() * 6)];
}

async function main() {
    const userId = 1;
    const set3: any = {};

    // Буревестник 4
    set3.helmet = { id:now(), name:'Гребень бури', slot:'helmet', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:0,a:26,d:0,m:20}, image:'helmet/helmet_yellow.webp', upgradeLevel:6,
        extra:{set:'Буревестник',crit:0,dodge:0,counter:0,fullBlock:0,setBonus2:'+10% ловкость',setBonus3:'Первый ход всегда твой',setBonus4:'+20% уклонение'},
        ...curseA(randomRank()) };
    set3.gloves = { id:now(), name:'Перчатки ветров', slot:'gloves', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:0,a:27,d:0,m:19}, image:'gloves/gloves_yellow.webp', upgradeLevel:6,
        extra:{set:'Буревестник',crit:0,dodge:0,counter:0,fullBlock:0,setBonus2:'+10% ловкость',setBonus3:'Первый ход всегда твой',setBonus4:'+20% уклонение'},
        ...curseA(randomRank()) };
    set3.amulet = { id:now(), name:'Амулет молнии', slot:'amulet', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:0,a:0,d:0,m:0}, image:'amulet/amulet_yellow.webp', upgradeLevel:6,
        extra:{set:'Буревестник',crit:0,dodge:23,counter:0,fullBlock:0,setBonus2:'+10% ловкость',setBonus3:'Первый ход всегда твой',setBonus4:'+20% уклонение'},
        ...curseA(randomRank()) };
    set3.boots = { id:now(), name:'Сапоги урагана', slot:'boots', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:22,a:24,d:0,m:0}, image:'boots/boots_yellow.webp', upgradeLevel:6,
        extra:{set:'Буревестник',crit:0,dodge:0,counter:0,fullBlock:0,setBonus2:'+10% ловкость',setBonus3:'Первый ход всегда твой',setBonus4:'+20% уклонение'},
        ...curseA(randomRank()) };
    // Гладиатор 2
    set3.weapon1 = { id:now(), name:'Гладиус чемпиона', slot:'weapon1', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:26,a:21,d:0,m:0}, image:'sword/sword_yellow.webp', upgradeLevel:6,
        extra:{set:'Гладиатор',crit:0,dodge:0,counter:0,fullBlock:0,setBonus2:'+15% урон +15% контратака',setBonus3:'+10% блок',setBonus4:'+10% ко всем статам'},
        ...curseA(randomRank()) };
    set3.shield = { id:now(), name:'Скутум гладиатора', slot:'shield', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:24,a:0,d:0,m:0}, image:'shield/shield_yellow.webp', upgradeLevel:6,
        extra:{set:'Гладиатор',crit:0,dodge:0,counter:0,fullBlock:21,setBonus2:'+15% урон +15% контратака',setBonus3:'+10% блок',setBonus4:'+10% ко всем статам'},
        ...curseA(randomRank()) };
    // Остальное
    set3.chest = { id:now(), name:'Багровый доспех', slot:'chest', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:25,a:0,d:22,m:0}, image:'chest/chest_red.webp', upgradeLevel:6,
        extra:{set:'Жнец',crit:0,dodge:0,counter:0,fullBlock:0,setBonus2:'+5% вампиризм',setBonus3:'+15% урон',setBonus4:'Добивание <10% HP'},
        ...curseA(randomRank()) };
    set3.belt = { id:now(), name:'Подкова удачи', slot:'belt', rarity_id:7, rarity_display:'Артефакт', rarity_color:'#ff4444',
        bonuses:{s:0,a:0,d:0,m:0}, image:'belt/belt_green.webp', upgradeLevel:6,
        extra:{crit:15,dodge:15,effect:'luck',counter:10,fullBlock:0,effectDesc:'+5% ко всем шансам',effectValue:5},
        ...curseA(randomRank()) };
    set3.ring1 = { id:now(), name:'Кольцо вампира', slot:'ring', rarity_id:7, rarity_display:'Артефакт', rarity_color:'#ff4444',
        bonuses:{s:0,a:0,d:0,m:0}, image:'ring/ring_red.webp', upgradeLevel:6,
        extra:{crit:22,dodge:0,effect:'vampirism',counter:18,fullBlock:0,effectDesc:'5% вампиризм',effectValue:5},
        ...curseA(randomRank()) };
    set3.ring2 = { id:now(), name:'Печатка разорванных душ', slot:'ring', rarity_id:6, rarity_display:'Мифический', rarity_color:'#e74c3c',
        bonuses:{s:0,a:0,d:0,m:0}, image:'ring/ring_red.webp', upgradeLevel:6,
        extra:{crit:0,dodge:24,counter:0,fullBlock:0},
        ...curseA(randomRank()) };

    await db.run('UPDATE users SET equipment_3 = ?::jsonb WHERE id = ?', [JSON.stringify(set3), userId]);
    
    console.log('Слот III (Анти-Салларик):');
    for (const key of Object.keys(set3)) {
        const item = set3[key];
        console.log(`  + ${item.name.padEnd(24)} [${item.slot}] curse ${item.curseName} +${item.curseValue} A`);
    }
    console.log('\nГотово.');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
