const { Pool } = require('pg');
const pool = new Pool({ database: 'game', user: 'game', password: 'game123', host: 'localhost' });
(async () => {
  // Ждуля id=31
  const r = await pool.query("SELECT id, username, currenthp, maxhp, lasthpupdate, roomtype, roomuntil, lastattacktime, protectionuntil FROM users WHERE id=31");
  const u = r.rows[0];
  console.log('Ждуля (31):');
  console.log('  currenthp:', u.currenthp);
  console.log('  maxhp:', u.maxhp);
  console.log('  lasthpupdate:', u.lasthpupdate);
  console.log('  roomtype:', u.roomtype);
  console.log('  roomuntil:', u.roomuntil);
  console.log('  lastattacktime:', u.lastattacktime);
  console.log('  protectionuntil:', u.protectionuntil);
  
  const now = Math.floor(Date.now() / 1000);
  console.log('\n  now:', now);
  const elapsed = now - (u.lasthpupdate || now);
  console.log('  elapsed:', elapsed);
  console.log('  hp < maxhp?', u.currenthp < u.maxhp);
  if (elapsed > 0 && u.currenthp < u.maxhp) {
    const regen = Math.floor(elapsed / 10); // 1 HP per 10 sec
    console.log('  regen amount:', regen);
    console.log('  new hp:', Math.min(u.maxhp, u.currenthp + regen));
  }
  
  await pool.end();
})();
