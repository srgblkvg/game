const Database = require('better-sqlite3');
const { Pool } = require('pg');

const sqlite = new Database('game_prod.db');
const pg = new Pool({
  host: 'localhost', port: 5432, database: 'game',
  user: 'game', password: 'game123',
});

function toSnake(s) {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

async function migrateTable(tn, opts = {}) {
  const sqliteCols = sqlite.prepare(`PRAGMA table_info('${tn}')`).all();
  const { rows: pgRows } = await pg.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [tn]
  );
  const pgCols = pgRows.map(r => r.column_name);
  
  // Build mapping
  const map = {}; // sqliteName → pgName
  const skipped = [];
  for (const c of sqliteCols) {
    const lower = c.name.toLowerCase();
    if (pgCols.includes(lower)) {
      map[c.name] = lower;
    } else {
      const snake = toSnake(c.name);
      if (pgCols.includes(snake)) {
        map[c.name] = snake;
      } else {
        skipped.push(c.name);
      }
    }
  }
  
  const rows = sqlite.prepare(`SELECT * FROM ${tn}`).all();
  if (rows.length === 0) { console.log(`  ${tn}: empty`); return; }
  if (Object.keys(map).length === 0) { console.log(`  ${tn}: NO COLUMNS MATCHED, skipped: ${skipped.join(',')}`); return; }
  
  const pgNames = Object.values(map);
  const cols = pgNames.join(', ');
  const ph = pgNames.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${tn} (${cols}) VALUES (${ph})`;
  
  let ok = 0, fail = 0;
  for (const row of rows) {
    const vals = Object.keys(map).map(k => {
      let v = row[k];
      if (v === null && opts.nullToZero && opts.nullToZero.includes(k)) return 0;
      return v;
    });
    try {
      await pg.query(sql, vals);
      ok++;
    } catch (e) {
      if (fail === 0) console.log(`  ${tn} FIRST ERROR: ${e.message.slice(0, 150)}`);
      fail++;
    }
  }
  console.log(`  ${tn}: ${ok} ok${fail ? ` (${fail} fail)` : ''}${skipped.length ? ` [skipped: ${skipped.join(',')}]` : ''}`);
}

async function main() {
  const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`Tables: ${tables.length}\n`);
  
  const usersNullToZero = [
    'currentHp','bank','lastHpUpdate','lastAttackTime','lastPveAttackTime',
    'protectionUntil','chatBannedUntil','lockedUntil','roomUntil','drinkUntil',
    'lastEloDecay','bannedUntil','lastPvpTime','lastPveRatingTime','premiumUntil',
    'lastBankVisit','seasonWins','seasonLosses','emailCodeExpires','statPoints'
  ];
  
  // Phase 1: all tables except users (FK dependencies)
  for (const t of tables) {
    if (t.name === 'users') continue;
    const opts = {};
    await migrateTable(t.name, opts);
  }
  
  // Phase 2: users
  await migrateTable('users', { nullToZero: usersNullToZero });
  
  // Reset sequences
  console.log('\nResetting sequences...');
  const { rows: seqs } = await pg.query(`SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'`);
  for (const s of seqs) {
    const tn = s.sequence_name.replace('_id_seq', '');
    try {
      await pg.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${tn}"), 1))`, [s.sequence_name]);
    } catch {}
  }
  console.log('  done');
  
  // Verify counts
  console.log('\nVerification:');
  for (const t of tables) {
    try {
      const { rows: pgCount } = await pg.query(`SELECT count(*) as cnt FROM "${t.name}"`);
      const sqliteCount = sqlite.prepare(`SELECT count(*) as cnt FROM "${t.name}"`).get();
      const ok = parseInt(pgCount[0].cnt) === sqliteCount.cnt;
      console.log(`  ${t.name}: PG=${pgCount[0].cnt} SQLite=${sqliteCount.cnt} ${ok ? '✓' : '✗ MISMATCH'}`);
    } catch (e) {
      console.log(`  ${t.name}: ERROR ${e.message.slice(0,60)}`);
    }
  }
  
  await pg.end();
  sqlite.close();
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
