const { db } = require('./dist/db/index');
const { runBattle } = require('./dist/game/battle');
const { currentStats } = require('./dist/game/stats');

function buildItem(row) {
  return {
    name: row.name, slot: row.slot, rarity_id: row.rarity_id,
    bonuses: typeof row.bonuses === 'string' ? JSON.parse(row.bonuses) : row.bonuses,
    extra: typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra,
    image: row.image, upgradeLevel: 0,
  };
}

async function equipSet(userId, itemIds) {
  const items = await db.query(`SELECT * FROM items WHERE id IN (${itemIds.join(',')})`);
  const equipment = {};
  for (const item of items) equipment[item.slot] = buildItem(item);
  await db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), userId]);
}

async function equipPartial(userId, itemIds) {
  const items = await db.query(`SELECT * FROM items WHERE id IN (${itemIds.join(',')})`);
  const equipmentStr = await db.one('SELECT equipment FROM users WHERE id = ?', [userId]);
  const equipment = JSON.parse(equipmentStr.equipment || '{}');
  for (const item of items) equipment[item.slot] = buildItem(item);
  await db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), userId]);
}

async function createUser(name, s, a, d, m) {
  await db.run(
    `INSERT INTO users (username, passwordHash, level, exp, money, currentHp, bases, basea, based, basem, equipment, inventory, statpoints)
     VALUES (?, '', 100, 0, 100000, ?, ?, ?, ?, ?, '{}', '[]', 0)`,
    [name, s+a+m, s, a, d, m]
  );
  return (await db.one('SELECT id FROM users WHERE username = ?', [name])).id;
}

async function main() {
  try {
    // Create 6 test users
    await createUser('T1_Berserk', 30, 20, 20, 30);
    await createUser('T2_Guardian', 30, 20, 20, 30);
    await createUser('T3_Reaper', 30, 20, 20, 30);
    await createUser('T4_Gladiator', 30, 20, 20, 30);
    await createUser('T5_Artifacts', 25, 25, 25, 25);
    await createUser('T6_Crusher', 30, 20, 20, 30);

    await equipSet(await db.one('SELECT id FROM users WHERE username=?',['T1_Berserk']).then(r=>r.id), [517,518,519,520]);
    await equipSet(await db.one('SELECT id FROM users WHERE username=?',['T2_Guardian']).then(r=>r.id), [521,522,523,524]);
    await equipSet(await db.one('SELECT id FROM users WHERE username=?',['T3_Reaper']).then(r=>r.id), [529,530,531,532]);
    await equipSet(await db.one('SELECT id FROM users WHERE username=?',['T4_Gladiator']).then(r=>r.id), [537,538,539,540]);
    await equipSet(await db.one('SELECT id FROM users WHERE username=?',['T5_Artifacts']).then(r=>r.id), [505,506,507,508]);
    await equipSet(await db.one('SELECT id FROM users WHERE username=?',['T6_Crusher']).then(r=>r.id), [533,534,535,536]);

    const pairs = [
      ['T1_Berserk', 'T2_Guardian'], ['T3_Reaper', 'T1_Berserk'],
      ['T2_Guardian', 'T3_Reaper'], ['T5_Artifacts', 'T2_Guardian'],
      ['T4_Gladiator', 'T1_Berserk'], ['T4_Gladiator', 'T3_Reaper'],
      ['T6_Crusher', 'T2_Guardian'], ['T6_Crusher', 'T1_Berserk'],
      ['T1_Berserk', 'T5_Artifacts'], ['T3_Reaper', 'T5_Artifacts'],
    ];

    const allBattles = [];

    for (let i = 0; i < 100; i++) {
      const [aName, dName] = pairs[i % pairs.length];
      const a = await db.one('SELECT * FROM users WHERE username = ?', [aName]);
      const d = await db.one('SELECT * FROM users WHERE username = ?', [dName]);
      
      const aBase = { s: a.bases, a: a.basea, d: a.based, m: a.basem };
      const dBase = { s: d.bases, a: d.basea, d: d.based, m: d.basem };
      const aEquip = JSON.parse(a.equipment || '{}');
      const dEquip = JSON.parse(d.equipment || '{}');
      const statsA = currentStats(aBase, aEquip);
      const statsD = currentStats(dBase, dEquip);
      
      const result = runBattle(
        { id: a.id, name: aName, base: aBase, equipment: aEquip, level: 100, money: 100000, currentHp: null, stats: statsA },
        { id: d.id, name: dName, base: dBase, equipment: dEquip, level: 100, money: 100000, currentHp: null, stats: statsD }
      );
      
      allBattles.push({ aName, dName, result, steps: result.steps.length, statsA, statsD, aEquip, dEquip });
    }

    // Sort by most steps (longest battles)
    allBattles.sort((a, b) => b.steps - a.steps);

    console.log('=== ТОП-10 САМЫХ ДОЛГИХ БОЁВ (из 100) ===\n');
    
    for (let i = 0; i < Math.min(10, allBattles.length); i++) {
      const b = allBattles[i];
      const winner = b.result.winnerId === (allBattles[i].aName === b.aName ? b.result.winnerId : null) ? b.aName : b.dName;
      
      console.log(`#${i+1} | ${b.steps} шагов | ${b.aName} vs ${b.dName} | Победитель: ${winner}`);
      console.log(`  ${b.aName}: ${Object.values(b.aEquip).map(e=>e.name).join(', ')}`);
      console.log(`    Статы: S=${b.statsA.s} A=${b.statsA.a} D=${b.statsA.d} M=${b.statsA.m} HP=${b.statsA.hp}`);
      console.log(`    ${b.statsA.setBonuses?.join('; ') || 'нет бонусов'}`);
      console.log(`  ${b.dName}: ${Object.values(b.dEquip).map(e=>e.name).join(', ')}`);
      console.log(`    Статы: S=${b.statsD.s} A=${b.statsD.a} D=${b.statsD.d} M=${b.statsD.m} HP=${b.statsD.hp}`);
      console.log(`    ${b.statsD.setBonuses?.join('; ') || 'нет бонусов'}`);
      console.log('  Бой:');
      for (const s of b.result.steps) {
        console.log(`    ${s.message}${s.damage ? ` (${s.damage})` : ''}`);
      }
      console.log('');
    }

    // Cleanup
    await db.run("DELETE FROM users WHERE username LIKE 'T%_'");
    console.log('=== Тестовые персонажи удалены ===');
  } catch(e) {
    console.error('ERROR:', e.stack);
    await db.run("DELETE FROM users WHERE username LIKE 'T%_'");
  }
  process.exit(0);
}

main();
