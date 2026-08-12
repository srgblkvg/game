const { Pool } = require("pg");
const pool = new Pool({ user: "game", password: "game123", host: "localhost", database: "game" });

async function main() {
  const cl = await pool.connect();
  try {
    // Get current (empty) inventory
    const r = await cl.query("SELECT inventory FROM users WHERE id = 1");
    console.log("Current:", JSON.stringify(r.rows[0].inventory).slice(0, 100));
    
    // Restore from a hardcoded backup
    // We need to reconstruct. Let me use the data from the original extraction.
    // Actually, let me check if there's a backup
    const backups = await cl.query("SELECT tablename FROM pg_tables WHERE tablename LIKE '%backup%'");
    console.log("Backup tables:", backups.rows.map(r=>r.tablename));
  } finally {
    cl.release();
    pool.end();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
