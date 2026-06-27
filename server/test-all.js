const jwt = require("jsonwebtoken");
const http = require("http");
const env = require("dotenv").config().parsed;

function apiGet(path) {
  const token = jwt.sign({ userId: 31, username: "Ждуля", role: "player" }, env.JWT_SECRET);
  return new Promise((resolve, reject) => {
    http.get({ hostname: "localhost", port: 3001, path, headers: { Authorization: *** " + token } }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d)));
    }).on("error", reject);
  });
}

async function main() {
  const char = await apiGet("/api/character/me");
  console.log("CHAR stats: S=" + char.stats.s + " HP=" + char.stats.hp + " guildBonus=" + char.guildBonus);

  // Arena opponent
  try {
    const opp = await apiGet("/api/arena/opponent?difficulty=equal");
    console.log("ARENA opp: " + opp.name + " lv" + opp.level + " S=" + opp.stats.s + " HP=" + opp.stats.hp);
  } catch(e) { console.log("ARENA error:", e.message); }

  // PvE — test via mobs endpoint (first floor mobs)
  try {
    const floors = await apiGet("/api/floors");
    if (floors.length > 0) {
      const mobsRes = await new Promise((resolve, reject) => {
        const token = jwt.sign({ userId: 31, username: "Ждуля", role: "player" }, env.JWT_SECRET);
        http.get({ hostname: "localhost", port: 3001, path: "/api/mobs?floorId=" + floors[0].id, headers: { Authorization: *** " + token } }, res => {
          let d = ""; res.on("data", c => d += c); res.on("end", () => resolve(JSON.parse(d)));
        }).on("error", reject);
      });
      console.log("MOBS floor:", floors[0].name, "mobs:", mobsRes.length);
    }
  } catch(e) { console.log("MOBS error:", e.message); }

  // Tournament
  try {
    const t = await apiGet("/api/tournaments");
    console.log("TOURNAMENTS:", t.length || 0, "active");
  } catch(e) { console.log("TOURNAMENT error:", e.message); }
}
main().catch(e => console.error(e));
