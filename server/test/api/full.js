require("dotenv").config();
const jwt = require("jsonwebtoken");
const http = require("http");
const token = jwt.sign({ userId: 31, username: "Ждуля", role: "player" }, process.env.JWT_SECRET);

function api(path, cb) {
  const opts = { hostname: "localhost", port: 3001, path, headers: { Authorization: "Bearer " + token } };
  http.get(opts, r => { let d = ""; r.on("data", c => d += c); r.on("end", () => { try { cb(null, JSON.parse(d)); } catch(e) { cb(e.message, d); } }); });
}

function run() {
  // 1. Character stats
  api("/api/character/me", (err, c) => {
    console.log("=== CHAR ===");
    console.log("stats: S=" + c.stats.s + " A=" + c.stats.a + " D=" + c.stats.d + " M=" + c.stats.m + " HP=" + c.stats.hp);
    console.log("base: S=" + c.baseStats.s + " A=" + c.baseStats.a + " D=" + c.baseStats.d + " M=" + c.baseStats.m);
    console.log("bonuses: " + JSON.stringify(c.stats.bonuses));
    console.log("guildBonus: " + c.guildBonus + " collection: " + c.collectionCount);

    // 2. Arena opponent
    api("/api/arena/opponent?difficulty=hard", (err, o) => {
      if (o && o.stats) {
        console.log("\n=== ARENA OPP ===");
        console.log(o.name + " lv" + o.level + " S=" + o.stats.s + " HP=" + o.stats.hp);
      } else {
        console.log("\n=== ARENA OPP: " + (o ? o.error : "none") + " ===");
      }

      // 3. Test PvE mob
      api("/api/floors", (err, floors) => {
        if (floors && floors.length > 0) {
          const fid = floors[0].id;
          api("/api/mobs?floorId=" + fid, (err, mobs) => {
            console.log("\n=== MOBS ===");
            if (mobs && mobs.length > 0) {
              const m = mobs[0];
              console.log("Mob: " + m.name + " S=" + m.s + " HP=" + m.hp);
              api("/api/players/" + c.id + "/loadout?context=pve", (err, p) => {
                if (p && p.stats) {
                  console.log("Player PvE loadout: S=" + p.stats.s + " HP=" + p.stats.hp + " gb=" + p.guildBonus);
                }
                console.log("\n=== SERVER-SIDE STATS ===");
                const statsSrv = require("../../dist/game/stats");
                const helpers = require("../../dist/db/helpers");
                const drinks = require("../../dist/game/drinks");
                const guildB = require("../../dist/game/guildBuildings");
                const db = require("../../dist/db/index").db;

                (async () => {
                  const u = await db.one("SELECT * FROM users WHERE id = 31");
                  const base = helpers.getBaseStats(u);
                  const eq = JSON.parse(u.equipment || "{}");
                  const dr = drinks.getDrinkBonuses(u);
                  const r = await db.one("SELECT COUNT(*) as cnt FROM collections WHERE userId = 31");
                  const cc = r.cnt;

                  for (const ctx of ["arena", "pve", "tournament", "war_attack", "war_defense"]) {
                    const gb = await guildB.getGuildBonus(31, ctx);
                    const st = statsSrv.currentStats(base, eq, dr, cc, gb);
                    console.log(ctx + ": gb=" + gb + " S=" + st.s + " HP=" + st.hp);
                  }
                  console.log("no guild: S=" + statsSrv.currentStats(base, eq, dr, cc, 0).s + " HP=" + statsSrv.currentStats(base, eq, dr, cc, 0).hp);
                })().catch(e => console.error(e));
              });
            }
          });
        }
      });
    });
  });
}
run();