const b = require('bcryptjs');
const { Pool } = require('pg');
(async () => {
  const p = new Pool({ host: 'localhost', port: 5432, database: 'game', user: 'game', password: 'game123' });
  const h = b.hashSync('Test123!@', 10);
  await p.query('UPDATE users SET passwordhash=$1 WHERE id=23', [h]);
  console.log('password set');
  p.end();
})();
