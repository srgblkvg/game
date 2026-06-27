require("dotenv").config();
const jwt = require("jsonwebtoken");
const http = require("http");
const token = jwt.sign({ userId: 31, username: "test", role: "player" }, process.env.JWT_SECRET);

http.get({
  hostname: "localhost", port: 3001,
  path: "/api/auction",
  headers: { Authorization: *** " + token }
}, res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    const j = JSON.parse(d);
    console.log("Lots:", j.lots ? j.lots.length : j.error || JSON.stringify(j).substring(0, 200));
    if (j.lots && j.lots[0]) console.log("First:", JSON.stringify(j.lots[0]).substring(0, 200));
  });
});
