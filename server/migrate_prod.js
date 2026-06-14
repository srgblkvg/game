const Database = require('better-sqlite3');
const { Pool } = require('pg');

const s = new Database('game_prod.db');
const p = new Pool({ host:'localhost',port:5432,database:'game',user:'game',password:'game123'});

async function migrateTable(tn) {
  const sc = s.prepare(`PRAGMA table_info('${tn}')`).all();
  const pgCols = (await p.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [tn])).rows.map(r=>r.column_name);
  
  const cols = [];
  for (const c of sc) {
    const lower = c.name.toLowerCase();
    if (pgCols.includes(lower)) cols.push({ sqlite: c.name, pg: lower });
  }
  if (!cols.length) { console.log(`  ${tn}: NO MATCH`); return 0; }

  const rows = s.prepare(`SELECT * FROM ${tn}`).all();
  if (!rows.length) { console.log(`  ${tn}: empty`); return 0; }

  const insertCols = cols.map(c => c.pg).join(',');
  const ph = cols.map((_,i) => '$'+(i+1)).join(',');
  const updateSet = cols.map(c => `${c.pg}=EXCLUDED.${c.pg}`).join(',');
  const sql = `INSERT INTO ${tn} (${insertCols}) VALUES (${ph}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`;

  // For composite PK tables, remove ON CONFLICT
  const isComposite = ['craft_recipe_ingredients','upgrade_chances','guild_members'].includes(tn);
  const finalSQL = isComposite ? `INSERT INTO ${tn} (${insertCols}) VALUES (${ph})` : sql;

  const nullToZero = ['currentHp','bank','lastHpUpdate','lastAttackTime','lastPveAttackTime',
    'protectionUntil','chatBannedUntil','lockedUntil','roomUntil','drinkUntil',
    'lastEloDecay','bannedUntil','lastPvpTime','lastPveRatingTime','premiumUntil','lastBankVisit'];
  
  let ok = 0, fail = 0;
  for (const row of rows) {
    const vals = cols.map(c => {
      let v = row[c.sqlite];
      if (v === null && nullToZero.includes(c.sqlite)) v = 0;
      return v;
    });
    try {
      await p.query(finalSQL, vals);
      ok++;
    } catch(e) {
      if (fail === 0) console.log(`  ${tn} ERR: ${e.message.slice(0,120)}`);
      fail++;
    }
  }
  console.log(`  ${tn}: ${ok} ok${fail ? ` (${fail} fail)` : ''}`);
  return ok;
}

async function main() {
  const tables = s.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  console.log(`Migrating ${tables.length} tables...\n`);
  
  for (const t of tables) {
    await migrateTable(t.name);
  }

  // Reset sequences
  console.log('\nReset sequences...');
  const seqs = (await p.query(`SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema='public'`)).rows;
  for (const seq of seqs) {
    const tn = seq.sequence_name.replace('_id_seq','');
    try { await p.query(`SELECT setval($1, COALESCE((SELECT MAX(id) FROM "${tn}"), 1))`, [seq.sequence_name]); } catch {}
  }

  // Verify
  console.log('\nVerify:');
  for (const t of tables) {
    const pc = parseInt((await p.query(`SELECT count(*) as cnt FROM "${t.name}"`)).rows[0].cnt);
    const sc = s.prepare(`SELECT count(*) as cnt FROM "${t.name}"`).get().cnt;
    console.log(`  ${t.name}: PG=${pc} SQLite=${sc} ${pc===sc?'✓':'✗'}`);
  }

  await p.end(); s.close();
  console.log('\nDone.');
}
main().catch(e => { console.error(e); process.exit(1); });
