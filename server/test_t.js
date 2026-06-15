const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});
(async()=>{
const now = Math.floor(Date.now()/1000);
const ins = await pool.query(
  "INSERT INTO tournaments (division,status,registrationstart,registrationend,prizepool,createdat,type,creatorid,entryfee,name,minlevel,maxlevel,basepool,maxplayers) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id",
  ["custom","registration",now,now+60,5000,new Date().toISOString(),"custom",74,0,"Тест 1 мин",1,999,5000,64]
);
const tid = ins.rows[0].id;
const users = await pool.query("SELECT id,username FROM users WHERE id!=0 ORDER BY id");
for(const u of users.rows) {
  try { await pool.query("INSERT INTO tournament_participants (tournamentid,userid) VALUES ($1,$2)", [tid, u.id]); }
  catch { console.log("Skip", u.username); }
}
const cnt = await pool.query("SELECT count(*) as c FROM tournament_participants WHERE tournamentid=$1",[tid]);
console.log("T"+tid, cnt.rows[0].c+" players, starts in 1 min");
pool.end();
})();
