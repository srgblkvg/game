// Simulate exactly what auth login route does
const pgPromise = require('pg-promise');
const bcrypt = require('bcryptjs');

// CamelCase (same as in database/index.ts)
function camelRows(rows) {
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (r[k] === null) {
        if (k === 'inventory') { r[k] = '[]'; continue; }
        if (k === 'equipment') { r[k] = '{}'; continue; }
        if (k === 'activejob' || k === 'openprivatetabs' || k === 'snapshot' ||
            k === 'log' || k === 'item_data' || k === 'bonuses' || k === 'extra') {
          r[k] = ''; continue;
        }
      }
      const cc = k.replace(/(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid|data|wins|losses)$/i,
        m => m.charAt(0).toUpperCase() + m.slice(1))
        .replace(/taxrate$/i, 'TaxRate').replace(/verified$/i, 'Verified');
      if (cc !== k) r[cc] = r[k];
    }
  }
  return rows;
}

function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const pgp = pgPromise();
const rawDb = pgp({ database: 'game', user: 'game', password: 'game123', host: 'localhost' });

(async () => {
  // Same query as auth route
  const login = 'hermes_test';
  const password = 'testtest';
  
  const userSql = convertPlaceholders("SELECT id, passwordHash, failedLogins, lockedUntil, bannedUntil FROM users WHERE username = ? OR email = ?");
  console.log('Converted SQL:', userSql);
  
  const rawResult = await rawDb.oneOrNone(userSql, [login, login]);
  console.log('Raw PG result:', JSON.stringify(rawResult));
  
  if (rawResult) {
    const userRow = camelRows([rawResult])[0];
    console.log('After camelRows:', JSON.stringify(userRow));
    console.log('Keys:', Object.keys(userRow));
    console.log('passwordHash exists:', 'passwordHash' in userRow);
    console.log('passwordHash value:', userRow.passwordHash);
    console.log('bcrypt compare:', bcrypt.compareSync(password, userRow.passwordHash));
  } else {
    console.log('NO USER FOUND');
  }
  
  // Also try with lowercase SQL column
  const userSql2 = convertPlaceholders("SELECT id, passwordhash, failedlogins, lockeduntil, banneduntil FROM users WHERE username = ? OR email = ?");
  console.log('\n--- With lowercase SQL ---');
  console.log('Converted SQL2:', userSql2);
  const rawResult2 = await rawDb.oneOrNone(userSql2, [login, login]);
  console.log('Raw result2:', JSON.stringify(rawResult2));
  
  await rawDb.$pool.end();
})();
