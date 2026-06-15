const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});

function pgLower(sql) {
  const strs = [];
  let c = sql.replace(/'[^']*'/g, m => { strs.push(m); return '__S'+(strs.length-1)+'__'; });
  c = c.replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, m => m.toLowerCase());
  return c.replace(/__S(\d+)__/g, (_,i) => strs[parseInt(i)]);
}

function pgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

(async () => {
  const tournamentId = 638;
  
  // Get participants (exactly like generateBracket)
  const sql = "SELECT tp.*, u.username, u.level, u.money, u.baseS, u.baseA, u.baseD, u.baseM, u.equipment, u.currentHp, u.statPoints, u.tournamentElo FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ? ORDER BY u.tournamentElo ASC";
  const lowered = pgLower(sql);
  console.log("SQL:", lowered);
  const q = pgParams(lowered);
  console.log("Params:", q);
  
  const r = await pool.query(q, [tournamentId]);
  console.log("Participants found:", r.rows.length);
  r.rows.forEach(p => console.log("  ", p.userid, p.username, "elo:", p.tournamentelo));

  if (r.rows.length >= 2) {
    const n = r.rows.length;
    // Try inserting a match
    const p1 = r.rows[0], p2 = r.rows[1];
    const insertSQL = "INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId) VALUES (?, 1, ?, ?, NULL)";
    const lowered2 = pgLower(insertSQL);
    const q2 = pgParams(lowered2);
    console.log("\nInsert SQL:", q2);
    console.log("Params:", [tournamentId, p1.userid, p2.userid]);
    
    try {
      const ins = await pool.query(q2, [tournamentId, p1.userid, p2.userid]);
      console.log("Insert result: rowCount=", ins.rowCount);
    } catch(e) {
      console.error("Insert ERROR:", e.message);
    }
  }
  
  // Check matches
  const m = await pool.query("SELECT * FROM tournament_matches WHERE tournamentid=$1", [tournamentId]);
  console.log("\nMatches after:", JSON.stringify(m.rows));
  
  pool.end();
})().catch(e => console.error(e));
