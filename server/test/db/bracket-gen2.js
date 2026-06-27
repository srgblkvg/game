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
  const tournamentId = 639;

  const participants = await query(
    "SELECT tp.*, u.username, u.level, u.money, u.baseS, u.baseA, u.baseD, u.baseM, u.equipment, u.currentHp, u.statPoints, u.tournamentElo FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ? ORDER BY u.tournamentElo ASC",
    [tournamentId]
  );
  console.log("Participants:", participants.length);

  if (participants.length >= 2) {
    const n = participants.length;
    function nextPowerOfTwo(n) { let p = 1; while (p < n) p *= 2; return p; }
    const slots = nextPowerOfTwo(n);
    const byes = slots - n;

    const seeded = [...participants];
    for (let i = 0; i < byes; i++) seeded.push(null);

    const half = slots / 2;
    console.log("slots:", slots, "half:", half);

    for (let i = 0; i < half; i++) {
      const p1 = seeded[i * 2];
      const p2 = seeded[i * 2 + 1];
      const p1Id = p1 ? p1.userid : null;
      const p2Id = p2 ? p2.userid : null;

      console.log("  i=" + i, "p1=" + (p1 ? p1.username : 'bye'), "p2=" + (p2 ? p2.username : 'bye'));

      if (p1Id === null && p2Id === null) { console.log("    skip"); continue; }

      console.log("    inserting...");
      const info = await run(
        "INSERT INTO tournament_matches (tournamentId, round, player1Id, player2Id, winnerId) VALUES (?, 1, ?, ?, NULL)",
        [tournamentId, p1Id, p2Id]
      );
      console.log("    result:", JSON.stringify(info));

      if (p1Id === null && p2Id !== null) {
        console.log("    bye: p2 wins");
        await run("UPDATE tournament_matches SET winnerId = ? WHERE id = ?", [p2Id, info.lastInsertRowid]);
      }
      if (p2Id === null && p1Id !== null) {
        console.log("    bye: p1 wins");
        await run("UPDATE tournament_matches SET winnerId = ? WHERE id = ?", [p1Id, info.lastInsertRowid]);
      }
    }
  }

  const matches = await pool.query("SELECT * FROM tournament_matches WHERE tournamentid=$1", [tournamentId]);
  console.log("\nMatches created:", matches.rows.length);
  pool.end();
})().catch(e => console.error("FATAL:", e.message, e.stack));

async function run(sql, params) {
  const q = pgParams(pgLower(sql));
  const isInsert = /^\s*INSERT\s+/i.test(q);
  if (isInsert) {
    try {
      const rq = q.replace(/;?\s*$/, '') + ' RETURNING id';
      const r = await pool.query(rq, params || []);
      return { changes: r.rowCount || 0, lastInsertRowid: r.rows[0]?.id || 0 };
    } catch (e) {
      console.log("RETURNING id FAILED:", e.message.slice(0, 100));
      const r = await pool.query(q, params || []);
      return { changes: r.rowCount || 0, lastInsertRowid: 0 };
    }
  }
  const r = await pool.query(q, params || []);
  return { changes: r.rowCount || 0, lastInsertRowid: 0 };
}

async function one(sql, params) {
  const q = pgParams(pgLower(sql));
  const r = await pool.query(q, params);
  return r.rows[0] || null;
}

async function query(sql, params) {
  const q = pgParams(pgLower(sql));
  const r = await pool.query(q, params);
  return r.rows;
}