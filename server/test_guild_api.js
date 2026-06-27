
require("dotenv").config();
const jwt = require("jsonwebtoken");
const http = require("http");
const token = jwt.sign({userId:31, username:"test", role:"player"}, process.env.JWT_SECRET);

function test(path, label) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3001${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, (res) => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          const status = j.error ? `ERR: ${j.error.substring(0, 60)}` : "OK";
          console.log(`  ${label}: ${status} (${res.statusCode})`);
        } catch {
          console.log(`  ${label}: NOT JSON (${res.statusCode}): ${data.substring(0, 50)}`);
        }
        resolve();
      });
    }).on("error", e => { console.log(`  ${label}: NET ERR ${e.message}`); resolve(); });
  });
}

async function main() {
  console.log("=== Guild API Health Check ===");
  await test("/api/guild/my", "guild/my");
  await test("/api/guild/list", "guild/list");
  await test("/api/guild/chat", "guild/chat");
  await test("/api/guild/requests", "guild/requests");
  await test("/api/guild/invites", "guild/invites");
  await test("/api/guild/treasury/history", "treasury/history");
  await test("/api/guild/war/status", "war/status");
  await test("/api/guild/quest", "guild/quest");
  console.log("=== Done ===");
}
main();
