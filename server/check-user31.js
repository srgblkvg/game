const { Pool } = require('pg');
const pool = new Pool({ database: 'game', user: 'game', password: 'game123', host: 'localhost' });
(async () => {
  const r = await pool.query("SELECT * FROM users WHERE id=31");
  const u = r.rows[0];
  console.log('User 31 (Ждуля):');
  const moneyFields = ['money', 'exp', 'wins', 'totalbattles', 'currentHp', 'maxHp', 'bases', 'basea', 'based', 'basem', 'statpoints', 'inventoryslots', 'level', 'failedlogins', 'lockeduntil', 'banneduntil', 'protectionuntil', 'lastattacktime'];
  for (const f of moneyFields) {
    console.log(`  ${f}: ${u[f]} (${typeof u[f]})`);
  }
  await pool.end();
})();
