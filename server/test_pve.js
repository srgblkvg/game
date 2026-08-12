const { Pool } = require('pg');
const pool = new Pool({host:'localhost',user:'game',password:'game123',database:'game'});
(async()=>{
  const u = (await pool.query('SELECT * FROM users WHERE id = 1')).rows[0];
  const m = (await pool.query("SELECT * FROM mobs WHERE name = 'Бездонный ужас'")).rows[0];
  console.log('User currentHp:', u.currentHp, 'bases:', u.bases, u.basea, u.based, u.basem);
  console.log('User maxHp:', u.bases + u.basea + u.basem);
  console.log('Mob hp:', m.hp);
  pool.end();
})();
