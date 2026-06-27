const jwt = require("jsonwebtoken");
const http = require("http");

require("dotenv").config();

function apiGet(path) {
  const token = jwt.sign({ userId: 31, username: "Ждуля", role: "player" }, process.env.JWT_SECRET);
  return new Promise((resolve, reject) => {
    http.get({ hostname: "localhost", port: 3001, path, headers: { Authorization: "Bearer " + token } }, res => {
      let d = ""; res.on("data", c => d += c); res.on("end", () => {
        try { resolve(JSON.parse(d)); } catch(e) { console.log("RAW:", d.substring(0, 300)); resolve(null); }
      });
    }).on("error", reject);
  });
}

async function main() {
  for (const diff of ["equal", "easy", "hard"]) {
    const r = await apiGet("/api/arena/opponent?difficulty=" + diff);
    if (r && r.stats) console.log(diff + ": " + r.name + " lv" + r.level + " S=" + r.stats.s + " HP=" + r.stats.hp);
    else if (r && r.error) console.log(diff + ": ERR " + r.error);
    else console.log(diff + ": no opponent");
  }

  const floors = await apiGet("/api/floors");
  if (floors && floors.length > 0) {
    console.log("Mobs test - floor: " + floors[0].name);
    for (const mob of floors[0].mobs.slice(0, 3)) {
      const result = await apiGet("/api/mobs/battle?mobId=" + mob.id);
      if (result && result.stats) console.log("MOB " + mob.name + " S=" + mob.s + " HP=" + mob.hp);
      else if (result && result.error) console.log("MOB " + mob.name + " err: " + result.error);
      else console.log("MOB " + mob.name + " no result");
    }
  }
}
main().catch(e => console.error(e));