const jwt = require("jsonwebtoken");
const http = require("http");

require("dotenv").config();
const token = jwt.sign({ userId: 31, username: "Ждуля", role: "player" }, process.env.JWT_SECRET);

http.get({
  hostname: "localhost", port: 3001,
  path: "/api/character/me",
  headers: { Authorization: "Bearer " + token }
}, res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    const j = JSON.parse(d);
    console.log("stats:", JSON.stringify(j.stats, null, 2));
    console.log("guildBonus:", j.guildBonus);
    console.log("collectionCount:", j.collectionCount);
  });
});