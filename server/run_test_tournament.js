// Тестовый турнир: Нейрохирург (1) vs Sallarik (131), без наград
const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', user: 'game', password: 'game123', database: 'game' });
const { runBattle } = require('/opt/game/server/dist/game/battle.js');
const { getBaseStats, enrichEquipment, getCollectionBonus } = require('/opt/game/server/dist/db/helpers.js');
const { getDrinkBonuses } = require('/opt/game/server/dist/game/drinks.js');
const { getGuildBonus } = require('/opt/game/server/dist/game/guildBuildings.js');
const { currentStats } = require('/opt/game/server/dist/game/stats.js');

async function loadPlayer(client, userId) {
  const r = await client.query(
    'SELECT id, username, level, money, bases, basea, based, basem, equipment, activedrink, drinkuntil FROM users WHERE id = $1',
    [userId]
  );
  const u = r.rows[0];
  if (!u) return null;
  const equip = JSON.parse(u.equipment || '{}');
  const { enriched } = await enrichEquipment(equip);
  const base = getBaseStats({ baseS: u.bases, baseA: u.basea, baseD: u.based, baseM: u.basem });
  const coll = await getCollectionBonus(userId);
  const drinks = getDrinkBonuses({ activeDrink: u.activedrink, drinkUntil: u.drinkuntil });
  const gb = await getGuildBonus(userId, 'tournament');
  const stats = currentStats(base, enriched, drinks, coll, gb);
  return {
    id: u.id, name: u.username, base, equipment: enriched,
    level: u.level, money: u.money || 0, currentHp: stats.hp,
    drinkBonuses: drinks, collectionBonus: coll, guildBonus: gb,
  };
}

async function main() {
  const client = await pool.connect();
  try {
    const now = Math.floor(Date.now() / 1000);

    // 1. Создать турнир
    const tRes = await client.query(
      `INSERT INTO tournaments (division, status, registrationstart, registrationend, prizepool, createdat, type, creatorid, entryfee, name, minlevel, maxlevel, basepool, maxplayers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      ['custom', 'registration', now - 120, now - 60, 0, new Date().toISOString(), 'custom', 1, 0, 'Тест: Нейрохирург vs Sallarik', 1, 999, 0, 2]
    );
    const tid = tRes.rows[0].id;
    console.log('Турнир #' + tid + ' создан');

    // 2. Регистрация
    await client.query('INSERT INTO tournament_participants (tournamentid, userid, goldenticket) VALUES ($1,1,0), ($1,131,0)', [tid]);
    await client.query("UPDATE tournaments SET status = 'in_progress' WHERE id = $1", [tid]);
    console.log('Игроки зарегистрированы, турнир запущен');

    // 3. Скобка: 1 матч
    await client.query('INSERT INTO tournament_matches (tournamentid, round, player1id, player2id) VALUES ($1,1,1,131)', [tid]);
    console.log('Скобка: R1 Нейрохирург vs Sallarik');

    // 4. Загрузить игроков и провести бой
    const p1 = await loadPlayer(client, 1);
    const p2 = await loadPlayer(client, 131);
    console.log(`${p1.name}: HP=${p1.currentHp} S=${p1.base.s}+${p1.equipment ? '...' : '0'} guildBonus=${p1.guildBonus}`);
    console.log(`${p2.name}: HP=${p2.currentHp} S=${p2.base.s}+${p2.equipment ? '...' : '0'} guildBonus=${p2.guildBonus}`);

    const result = runBattle(p1, p2);
    const tourSteps = result.steps.filter(s => s.type !== 'money');
    await client.query('UPDATE tournament_matches SET winnerid = $1, log = $2 WHERE tournamentid = $3 AND round = 1',
      [result.winnerId, JSON.stringify(tourSteps), tid]);
    console.log(`Победитель: ${result.winnerId === 1 ? 'Нейрохирург' : 'Sallarik'} (${result.winnerId})`);

    // 5. Завершить турнир (без призов — pool=0)
    await client.query("UPDATE tournaments SET status = 'completed', completedat = $1 WHERE id = $2",
      [new Date().toISOString(), tid]);
    await client.query('UPDATE tournament_participants SET snapshotstats = $1 WHERE tournamentid = $2 AND userid = $3',
      [JSON.stringify({ place: 1, prize: 0 }), tid, result.winnerId]);
    const loserId = result.winnerId === 1 ? 131 : 1;
    await client.query('UPDATE tournament_participants SET snapshotstats = $1 WHERE tournamentid = $2 AND userid = $3',
      [JSON.stringify({ place: 2, prize: 0 }), tid, loserId]);
    await client.query('UPDATE users SET tournamentwins = tournamentwins + 1 WHERE id = $1', [result.winnerId]);
    await client.query('UPDATE users SET tournamentwins = tournamentwins + 1 WHERE id = $1', [loserId]);
    console.log('Турнир завершён. Бой:');
    for (const s of tourSteps) console.log('  ' + s.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
