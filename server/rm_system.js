const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});
(async()=>{
const s = await pool.query("SELECT id,username FROM users WHERE username ILIKE $1 OR id=0", ["%system%"]);
console.log("System users:", JSON.stringify(s.rows));
if(s.rows.length>0) {
  await pool.query("DELETE FROM tournament_participants WHERE tournamentid=648 AND userid=$1", [s.rows[0].id]);
  console.log("Removed:", s.rows[0].username);
}
const cnt = await pool.query("SELECT count(*) as c FROM tournament_participants WHERE tournamentid=648");
console.log("Remaining players:", cnt.rows[0].c);
pool.end();
})();
