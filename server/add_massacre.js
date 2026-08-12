const { Pool } = require('pg');
const pool = new Pool({host:'localhost',user:'game',password:'game123',database:'game'});

async function main() {
  const { buildPlayerStats } = require('./dist/db/helpers');
  
  // Новый ивент
  const events = await pool.query("SELECT id FROM massacre_events WHERE status = 'gathering' ORDER BY id DESC LIMIT 1");
  const eventId = events.rows[0].id;
  console.log('Event:', eventId);
  
  // Все онлайн
  const users = await pool.query(
    "SELECT * FROM users WHERE lastaction::bigint > EXTRACT(EPOCH FROM NOW() - INTERVAL '5 minutes')::bigint AND isguest = 0"
  );
  
  for (const u of users.rows) {
    const stats = await buildPlayerStats(u, 'arena');
    const hpMax = stats.hp;
    const hpCur = u.currenthp || hpMax;
    
    await pool.query(
      `INSERT INTO massacre_participants (event_id, user_id, level, base_s, base_a, base_d, base_m, hp_current, hp_max, stats_json, alive, stunned)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,false)
       ON CONFLICT DO NOTHING`,
      [eventId, u.id, u.level, u.bases, u.basea, u.based, u.basem, hpCur, hpMax, JSON.stringify(stats)]
    );
    console.log('Added:', u.username, 'level', u.level, 'hp', hpCur+'/'+hpMax);
  }
  
  // Проверка
  const count = await pool.query('SELECT COUNT(*) FROM massacre_participants WHERE event_id = $1', [eventId]);
  console.log('Total participants:', count.rows[0].count);
  
  pool.end();
}
main().catch(e => { console.error(e); pool.end(); });
