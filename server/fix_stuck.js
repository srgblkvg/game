const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});

(async()=>{
// Найти все in_progress турниры без матчей
const stuck = await pool.query(
  "SELECT t.id FROM tournaments t WHERE t.status='in_progress' AND (SELECT count(*) FROM tournament_matches WHERE tournamentid=t.id)=0"
);
console.log("Stuck tournaments:", stuck.rows.length);

for (const t of stuck.rows) {
  const tid = t.id;
  console.log("Fixing tournament", tid);
  
  // Найти участников
  const parts = await pool.query(
    "SELECT tp.userid, u.tournamentelo FROM tournament_participants tp JOIN users u ON tp.userid=u.id WHERE tp.tournamentid=$1 ORDER BY u.tournamentelo ASC",
    [tid]
  );
  
  if (parts.rows.length < 2) {
    // Отменить
    await pool.query("UPDATE tournaments SET status='cancelled',completedat=$1 WHERE id=$2", [new Date().toISOString(), tid]);
    console.log("  Cancelled (< 2 participants)");
    continue;
  }
  
  // Создать матчи (соседние пары)
  const n = parts.rows.length;
  let slots = 1; while (slots < n) slots *= 2;
  const half = slots / 2;
  
  for (let i = 0; i < half; i++) {
    const p1 = parts.rows[i*2] || null;
    const p2 = parts.rows[i*2+1] || null;
    
    if (!p1 && !p2) continue;
    
    const ins = await pool.query(
      "INSERT INTO tournament_matches (tournamentid, round, player1id, player2id) VALUES ($1,1,$2,$3) RETURNING id",
      [tid, p1?.userid || null, p2?.userid || null]
    );
    const mid = ins.rows[0].id;
    
    // Bye handling
    if (!p1 && p2) await pool.query("UPDATE tournament_matches SET winnerid=$1 WHERE id=$2", [p2.userid, mid]);
    if (!p2 && p1) await pool.query("UPDATE tournament_matches SET winnerid=$1 WHERE id=$2", [p1.userid, mid]);
    
    console.log("  Created match", mid, p1?.userid, "vs", p2?.userid);
  }
}
console.log("Done");
pool.end();
})();
