const { Pool } = require('pg');
const pool = new Pool({ database: 'game', user: 'game', password: 'game123', host: 'localhost' });
(async () => {
  // Check real user HP data
  const r = await pool.query("SELECT id, username, currenthp, maxhp, lasthpupdate, roomtype, roomuntil FROM users WHERE id IN (31, 23, 1)");
  for (const u of r.rows) {
    console.log(`${u.username} (${u.id}): currenthp=${u.currenthp} maxhp=${u.maxhp} lasthpupdate=${u.lasthpupdate}`);
  }
  
  // Check rating
  const rating = await pool.query("SELECT id, username, elo, seasonwins, seasonlosses FROM users WHERE elo > 0 LIMIT 3");
  console.log('\nRating users:', rating.rows.length);
  for (const u of rating.rows) {
    console.log(`  ${u.username}: elo=${u.elo}`);
  }
  
  await pool.end();
})();
