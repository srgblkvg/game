const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});

// Exact copy of pgLowerIdentifiers from db/index.ts
function pgLowerIdentifiers(sql) {
  const strings = [];
  let cleaned = sql.replace(/'[^']*'/g, (m) => {
    strings.push(m);
    return '__STR_' + (strings.length - 1) + '__';
  });
  cleaned = cleaned.replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, (m) => m.toLowerCase());
  return cleaned.replace(/__STR_(\d+)__/g, (_, i) => strings[parseInt(i)]);
}

function pgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

// Exact same camelRows from db/index.ts
function camelRows(rows) {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (typeof row[key] === 'string' && /^\d+$/.test(row[key])) {
        const n = parseInt(row[key], 10);
        if (n > 2147483647 || /^(id|count|level|cnt|total|sum|amount|price|cost|fee|rate|score|elo|rating|hp|exp|gold|money|slots|points|duration|chance|round|year|month|day|hour|min|sec|limit|offset|page|rank)$/i.test(key)) {
          row[key] = n;
        }
      }
    }
    const nullFields = ['inventory','equipment','activejob','openprivatetabs','snapshot','log','item_data','bonuses','extra'];
    for (const k of nullFields) { if (row[k] === null) row[k] = ''; }
    if (row.inventory === '') row.inventory = '[]';
    if (row.equipment === '') row.equipment = '{}';
    if (row.inventory === null) row.inventory = '[]';
    if (row.equipment === null) row.equipment = '{}';

    for (const key of Object.keys(row)) {
      let cc = key.replace(
        /(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid|data|wins|losses|pvp|bankvisit|max|min|job|order|image|chance|battles|money|created|upgraded|broken|seconds|xp|end|start|elo|score|number|players|ticket|stats|place|tag|text|chat|from|guild|role|last|first|ip|url|path|size|width|height|color|tier|slot|icon|attacked|made)$/i,
        m => m.charAt(0).toUpperCase() + m.slice(1)
      );
      cc = cc.replace(/attacktime$/i, 'AttackTime')
             .replace(/pveattacktime$/i, 'PveAttackTime')
             .replace(/attacksec$/i, 'AttackSec')
             .replace(/pveattacksec$/i, 'PveAttackSec')
             .replace(/taxrate$/i, 'TaxRate')
             .replace(/verified$/i, 'Verified')
             .replace(/hpupdate$/i, 'HpUpdate')
             .replace(/^bases$/i, 'baseS').replace(/^basea$/i, 'baseA')
             .replace(/^based$/i, 'baseD').replace(/^basem$/i, 'baseM')
             .replace(/^statpoints$/i, 'statPoints')
             .replace(/^totalbattles$/i, 'totalBattles')
             .replace(/^pvetotalbattles$/i, 'pveTotalBattles')
             .replace(/^pvewins$/i, 'pveWins')
             .replace(/^totalpvpmoneywon$/i, 'totalPvpMoneyWon')
             .replace(/^totalpvpmoneylost$/i, 'totalPvpMoneyLost')
             .replace(/^totalpvemoneywon$/i, 'totalPveMoneyWon')
             .replace(/^totalpvemoneylost$/i, 'totalPveMoneyLost')
             .replace(/^totaljobmoney$/i, 'totalJobMoney')
             .replace(/^totaljobseconds$/i, 'totalJobSeconds')
             .replace(/^craftcreated$/i, 'craftCreated')
             .replace(/^craftupgraded$/i, 'craftUpgraded')
             .replace(/^craftbroken$/i, 'craftBroken')
             .replace(/^tournamentcount$/i, 'tournamentCount')
             .replace(/^tournamentwins$/i, 'tournamentWins')
             .replace(/^auctiontrades$/i, 'auctionTrades')
             .replace(/^emailverified$/i, 'emailVerified')
             .replace(/^isguest$/i, 'isGuest')
             .replace(/([a-z])guildid$/i, '$1GuildId')
             .replace(/^oauthprovider$/i, 'oauthProvider')
             .replace(/^oauthid$/i, 'oauthId')
             .replace(/^rewardxp$/i, 'rewardXp')
             .replace(/^accountnumber$/i, 'accountNumber')
             .replace(/^arenatopponentid$/i, 'arenaOpponentId')
             .replace(/lastattackedat$/i, 'lastAttackedAt');
      if (cc !== key) row[cc] = row[key];
    }
  }
  return rows;
}

(async () => {
  const tournamentId = 640;
  
  // Step 1: Get participants (exactly as generateBracket does)
  const sql = "SELECT tp.*, u.username, u.level, u.money, u.baseS, u.baseA, u.baseD, u.baseM, u.equipment, u.currentHp, u.statPoints, u.tournamentElo FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ? ORDER BY u.tournamentElo ASC";
  
  const lowered = pgLowerIdentifiers(sql);
  const paramed = pgParams(lowered);
  const r = await pool.query(paramed, [tournamentId]);
  const rows = camelRows(r.rows);
  
  console.log("Participants:", rows.length);
  const p = rows[0];
  console.log("Keys with capitals:", Object.keys(p).filter(k => k !== k.toLowerCase()));
  console.log("p.userId:", p.userId);
  console.log("p.userid:", p.userid);
  
  // Step 2: Try to insert (exactly as db.run does)
  if (rows.length >= 2) {
    const p1 = rows[0], p2 = rows[1];
    const p1Id = p1 ? p1.userId : null;
    const p2Id = p2 ? p2.userId : null;
    console.log("\np1Id:", p1Id, "p2Id:", p2Id);
    
    if (p1Id !== null && p2Id !== null) {
      const insertSQL = "INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId) VALUES (?, 1, ?, ?, NULL)";
      const q = pgParams(pgLowerIdentifiers(insertSQL));
      console.log("INSERT SQL:", q);
      console.log("Params:", [tournamentId, p1Id, p2Id]);
      
      // Try RETURNING id
      try {
        const rq = q.replace(/;?\s*$/, '') + ' RETURNING id';
        const ins = await pool.query(rq, [tournamentId, p1Id, p2Id]);
        console.log("RETURNING OK, id:", ins.rows[0]?.id);
      } catch(e) {
        console.log("RETURNING failed:", e.message);
        const ins2 = await pool.query(q, [tournamentId, p1Id, p2Id]);
        console.log("Fallback OK, rows:", ins2.rowCount);
      }
    } else {
      console.log("SKIP - null IDs. userId is missing!");
    }
  }
  
  // Check matches
  const m = await pool.query("SELECT count(*) as cnt FROM tournament_matches WHERE tournamentid=$1", [tournamentId]);
  console.log("\nTotal matches:", m.rows[0].cnt);
  
  pool.end();
})().catch(e => console.error("FATAL:", e.message));
