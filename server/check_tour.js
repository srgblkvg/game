const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});
(async()=>{
const t = await pool.query("SELECT id,division,status FROM tournaments WHERE status IN ('in_progress','registration') ORDER BY id DESC LIMIT 5");
console.log("Tournaments:", JSON.stringify(t.rows));
for(const tr of t.rows) {
  const m = await pool.query("SELECT round,player1id,player2id,winnerid FROM tournament_matches WHERE tournamentid=$1 ORDER BY round,id", [tr.id]);
  console.log("  Matches for", tr.id, ":", JSON.stringify(m.rows));
  if(m.rows.length===0) {
    const p = await pool.query("SELECT tp.*, u.username FROM tournament_participants tp JOIN users u ON tp.userid=u.id WHERE tp.tournamentid=$1", [tr.id]);
    console.log("  Participants:", JSON.stringify(p.rows));
  }
}
pool.end();
})();
