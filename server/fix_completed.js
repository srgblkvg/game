const { Pool } = require("pg");
const pool = new Pool({host:"localhost",user:"game",password:"game123",database:"game"});
(async()=>{
const r = await pool.query("UPDATE tournaments SET completedat=createdat WHERE status IN ('completed','cancelled') AND completedat IS NULL");
console.log("Fixed:", r.rowCount, "tournaments");
pool.end();
})();
