const { db } = require('./dist/db/index');
const { runBattle } = require('./dist/game/battle');

function buildItem(row) {
  return {
    name: row.name,
    slot: row.slot,
    rarity_id: row.rarity_id,
    bonuses: typeof row.bonuses === 'string' ? JSON.parse(row.bonuses) : row.bonuses,
    extra: typeof row.extra === 'string' ? JSON.parse(row.extra) : row.extra,
    image: row.image,
    upgradeLevel: 0,
  };
}

async function equipSet(userId, itemIds) {
  const items = await db.query(`SELECT * FROM items WHERE id IN (${itemIds.join(',')})`);
  const equipment = {};
  for (const item of items) {
    const eq = buildItem(item);
    const slot = item.slot;
    equipment[slot] = eq;
  }
  await db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), userId]);
  return equipment;
}

async function createTestUser(name, s, a, d, m) {
  const hp = s + a + m;
  await db.run(
    `INSERT INTO users (username, passwordHash, level, exp, money, currentHp, bases, basea, based, basem, equipment, inventory, statpoints)
     VALUES (?, '', 100, 0, 100000, ?, ?, ?, ?, ?, '{}', '[]', 0)`,
    [name, hp, s, a, d, m]
  );
  const u = await db.one('SELECT id FROM users WHERE username = ?', [name]);
  return u.id;
}

async function equipPartial(userId, itemIds) {
  const items = await db.query(`SELECT * FROM items WHERE id IN (${itemIds.join(',')})`);
  const equipmentStr = await db.one('SELECT equipment FROM users WHERE id = ?', [userId]);
  const equipment = JSON.parse(equipmentStr.equipment || '{}');
  for (const item of items) {
    const eq = buildItem(item);
    equipment[item.slot] = eq;
  }
  await db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), userId]);
  return equipment;
}

async function runTest(aName, dName) {
  const a = await db.one('SELECT * FROM users WHERE username = ?', [aName]);
  const d = await db.one('SELECT * FROM users WHERE username = ?', [dName]);
  
  const aBase = { s: a.bases, a: a.basea, d: a.based, m: a.basem };
  const dBase = { s: d.bases, a: d.basea, d: d.based, m: d.basem };
  const aEquip = typeof a.equipment === 'string' ? JSON.parse(a.equipment) : (a.equipment || {});
  const dEquip = typeof d.equipment === 'string' ? JSON.parse(d.equipment) : (d.equipment || {});
  
  const statsA = require('./dist/game/stats').currentStats(aBase, aEquip);
  const statsD = require('./dist/game/stats').currentStats(dBase, dEquip);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${aName} (Сет: ${statsA.setBonuses?.join(', ') || 'нет'})`);
  console.log(`   Статы: S=${statsA.s} A=${statsA.a} D=${statsA.d} M=${statsA.m} HP=${statsA.hp}`);
  console.log(`   Extra: Крит=${statsA.extra.crit} Укл=${statsA.extra.dodge} Ктр=${statsA.extra.counter} Блок=${statsA.extra.fullBlock}`);
  console.log(`   Вампиризм=${statsA.vampirism||0}% Ярость=${statsA.rageDmg||0}%(${Math.round((statsA.rageThreshold||0)*100)}%) Добивание=${statsA.execute?'да':'нет'} БлокПен=${statsA.blockPen||0}%`);
  console.log(`   Ответка=${statsA.counterOnHit||0}% Яд=${statsA.poisonOnHit||0}% Удача=${statsA.luckBoost||0}% Стойкость=${statsA.resiliencePct||0}%`);
  console.log(`   ПервыйХод=${statsA.alwaysFirst?'да':'нет'}`);
  console.log(`\n${dName} (Сет: ${statsD.setBonuses?.join(', ') || 'нет'})`);
  console.log(`   Статы: S=${statsD.s} A=${statsD.a} D=${statsD.d} M=${statsD.m} HP=${statsD.hp}`);
  console.log(`   Extra: Крит=${statsD.extra.crit} Укл=${statsD.extra.dodge} Ктр=${statsD.extra.counter} Блок=${statsD.extra.fullBlock}`);
  console.log(`   Вампиризм=${statsD.vampirism||0}% Ярость=${statsD.rageDmg||0}%(${Math.round((statsD.rageThreshold||0)*100)}%) Добивание=${statsD.execute?'да':'нет'} БлокПен=${statsD.blockPen||0}%`);
  console.log(`   Ответка=${statsD.counterOnHit||0}% Яд=${statsD.poisonOnHit||0}% Удача=${statsD.luckBoost||0}% Стойкость=${statsD.resiliencePct||0}%`);
  console.log(`   ПервыйХод=${statsD.alwaysFirst?'да':'нет'}`);
  
  const result = runBattle(
    { id: a.id, name: a.username, base: aBase, equipment: aEquip, level: a.level, money: a.money, currentHp: a.currenthp, stats: statsA },
    { id: d.id, name: d.username, base: dBase, equipment: dEquip, level: d.level, money: d.money, currentHp: d.currenthp, stats: statsD }
  );
  
  const winner = result.winnerId === a.id ? aName : dName;
  console.log(`\nПобедитель: ${winner} [HP: ${result.attackerHpAfter}/${statsA.hp} vs ${result.defenderHpAfter}/${statsD.hp}]`);
  console.log('Бой:');
  for (const s of result.steps) {
    const hpInfo = s.hp1 != null ? ` [${s.hp1}/${s.maxHp1} vs ${s.hp2}/${s.maxHp2}]` : '';
    console.log(`  ${s.message}${hpInfo}`);
  }
  return result;
}

async function main() {
  try {
    // Create test users - equal base stats, different sets
    const id1 = await createTestUser('TEST_Berserk_Full', 30, 20, 20, 30);
    const id2 = await createTestUser('TEST_Guardian_Full', 30, 20, 20, 30);
    const id3 = await createTestUser('TEST_Reaper_Full', 30, 20, 20, 30);
    const id4 = await createTestUser('TEST_Artifacts', 25, 25, 25, 25);
    const id5 = await createTestUser('TEST_Hermit_Partial', 25, 25, 25, 25);
    const id6 = await createTestUser('TEST_Gladiator_Full', 30, 20, 20, 30);

    // Full sets
    await equipSet(id1, [517, 518, 519, 520]); // Берсерк
    await equipSet(id2, [521, 522, 523, 524]); // Страж
    await equipSet(id3, [529, 530, 531, 532]); // Жнец
    await equipSet(id6, [537, 538, 539, 540]); // Гладиатор
    
    // Artifacts only
    await equipSet(id4, [505, 506, 507, 508]);
    
    // Partial set (2 pieces Hermit)
    await equipPartial(id5, [513, 514]); // Helmet + Chest only

    // RUN TESTS
    await runTest('TEST_Berserk_Full', 'TEST_Guardian_Full');
    await runTest('TEST_Reaper_Full', 'TEST_Berserk_Full');
    await runTest('TEST_Guardian_Full', 'TEST_Reaper_Full');
    await runTest('TEST_Artifacts', 'TEST_Guardian_Full');
    await runTest('TEST_Gladiator_Full', 'TEST_Berserk_Full');
    await runTest('TEST_Gladiator_Full', 'TEST_Reaper_Full');
    await runTest('TEST_Guardian_Full', 'TEST_Hermit_Partial');

    // Cleanup
    await db.run('DELETE FROM users WHERE username LIKE ?', ['TEST_%']);
    console.log('\n=== Тестовые персонажи удалены ===');
    
  } catch(e) {
    console.error('ERROR:', e.stack);
    await db.run('DELETE FROM users WHERE username LIKE ?', ['TEST_%']);
  }
  process.exit(0);
}

main();
