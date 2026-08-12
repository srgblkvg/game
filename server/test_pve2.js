const { Pool } = require('pg');
const pool = new Pool({host:'localhost',user:'game',password:'game123',database:'game'});

// Эмулируем фрагмент mobs.ts чтобы понять что в шагах
const { currentStats } = require('./dist/game/stats');
const { runBattle } = require('./dist/game/battle');

(async()=>{
  const u = (await pool.query('SELECT * FROM users WHERE id = 1')).rows[0];
  const m = (await pool.query("SELECT * FROM mobs WHERE name = 'Бездонный ужас'")).rows[0];
  
  const userStats = currentStats({s:u.bases,a:u.basea,d:u.based,m:u.basem}, JSON.parse(u.equipment||'{}'));
  const mobStats = currentStats({s:m.atk,a:m.agi,d:m.def,m:m.mst}, {});
  
  const hpUser = u.currenthp || userStats.hp;
  const hpMob = m.hp;
  const maxHpUser = userStats.hp;
  const maxHpMob = m.hp;
  
  console.log('hpUser:', hpUser, 'maxHpUser:', maxHpUser);
  console.log('hpMob:', hpMob, 'maxHpMob:', maxHpMob);
  
  const result = runBattle(
    { id: 1, name: u.username, base: {s:u.bases,a:u.basea,d:u.based,m:u.basem}, equipment: JSON.parse(u.equipment||'{}'), level: u.level, money: u.money, currentHp: hpUser, stats: userStats },
    { id: -m.id, name: m.name, base: {s:m.atk,a:m.agi,d:m.def,m:m.mst}, equipment: {}, level: m.level, money: 0, currentHp: hpMob, stats: mobStats }
  );
  
  // Показать первые 5 шагов с hp/maxHp
  for (let i = 0; i < Math.min(5, result.steps.length); i++) {
    const s = result.steps[i];
    console.log();
  }
  
  pool.end();
})();
