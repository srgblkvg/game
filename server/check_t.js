const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});
(async()=>{
const t = await pool.query("SELECT id,division,type,status FROM tournaments WHERE status IN ('in_progress','registration') ORDER BY id DESC LIMIT 5");
console.log("Active:", JSON.stringify(t.rows));
if(t.rows.length>0) {
  for(const tr of t.rows) {
    const m = await pool.query("SELECT count(*) as cnt FROM tournament_matches WHERE tournamentid=$1", [tr.id]);
    console.log("  T"+tr.id, "matches:", m.rows[0].cnt);
  }
}
pool.end();
})();
