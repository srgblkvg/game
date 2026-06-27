const { Pool } = require("pg");
const pool = new Pool({ host: "localhost", user: "game", password: "game123", database: "game" });

function pgLower(sql) {
  const strs = [];
  let c = sql.replace(/'[^']*'/g, m => { strs.push(m); return '__S' + (strs.length - 1) + '__'; });
  c = c.replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, m => m.toLowerCase());
  return c.replace(/__S(\d+)__/g, (_, i) => strs[parseInt(i)]);
}

function pgParams(sql) { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); }

(async () => {
  const sql = "INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId) VALUES (?, 1, ?, ?, NULL)";
  const params = [639, 74, 31];

  const lowered = pgLower(sql);
  console.log("1. Lowered:", lowered);

  const paramed = pgParams(lowered);
  console.log("2. Paramed:", paramed);

  const withReturning = paramed.replace(/;?\s*$/, '') + ' RETURNING id';
  console.log("3. With RETURNING:", withReturning);
  console.log("   Params:", JSON.stringify(params));

  try {
    const r = await pool.query(withReturning, params);
    console.log("4. RETURNING OK, rowCount:", r.rowCount, "id:", r.rows[0]?.id);
  } catch (e) {
    console.log("4. RETURNING FAILED:", e.message);
    const r2 = await pool.query(paramed, params);
    console.log("5. Fallback OK, rowCount:", r2.rowCount);
  }

  pool.end();
})().catch(e => console.error(e));