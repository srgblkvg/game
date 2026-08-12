const { Pool } = require('pg');
const pool = new Pool({host:'localhost',user:'game',password:'game123',database:'game'});

async function main() {
  const { buildPlayerStats } = require('./dist/db/helpers');
  
  // Найти gathering ивент
  const events = await pool.query("SELECT id FROM massacre_events WHERE status = 'gathering' ORDER BY id DESC LIMIT 1");
  if (events.rows.length === 0) {
    // Создать новый
    const now = Math.floor(Date.now() / 1000);
    await pool.query("INSERT INTO massacre_events (status, entry_fee, gathering_end, created_at) VALUES ('gathering', 100, $1, NOW())", [now + 300]);
    const newEv = await pool.query("SELECT id FROM massacre_events WHERE status = 'gathering' ORDER BY id DESC LIMIT 1");
    var eventId = newEv.rows[0].id;
    console.log('Created event:', eventId);
  } else {
    var eventId = events.rows[0].id;
    console.log('Using event:', eventId);
  }
  
  // Все онлайн
  const users = await pool.query(
    "SELECT * FROM users WHERE lastaction::bigint > EXTRACT(EPOCH FROM NOW() - INTERVAL '5 minutes')::bigint AND isguest = 0"
  );
  console.log('Online:', users.rows.map(u => u.username).join(', '));
  
  for (const u of users.rows) {
    const stats = await buildPlayerStats(u, 'arena');
    const hpMax = stats.hp;
    const hpCur = u.currenthp || hpMax;
    
    await pool.query(
      `INSERT INTO massacre_participants (event_id, user_id, level, base_s, base_a, base_d, base_m, hp_current, hp_max, stats_json, alive, stunned)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true,false)
       ON CONFLICT (event_id, user_id) DO UPDATE SET hp_current = $8, hp_max = $9, stats_json = $10, alive = true, stunned = false`,
      [eventId, u.id, u.level, u.bases, u.basea, u.based, u.basem, hpCur, hpMax, JSON.stringify(stats)]
    );
    console.log('Added/updated:', u.username, 'hp', hpCur+'/'+hpMax);
  }
  
  const count = await pool.query('SELECT COUNT(*) FROM massacre_participants WHERE event_id = $1', [eventId]);
  console.log('Total:', count.rows[0].count);
  
  pool.end();
}
main().catch(e => { console.error(e); pool.end(); });
