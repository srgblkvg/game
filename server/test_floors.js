const jwt = require("jsonwebtoken");
const http = require("http");
const env = require("dotenv").config().parsed;
const token = jwt.sign({ userId: 31, username: "x", role: "player" }, env.JWT_SECRET);
http.get({ hostname: "localhost", port: 3001, path: "/api/floors",
  headers: { Authorization: "*** " + token }
}, res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    const data = JSON.parse(d);
    console.log("floors:", data.floors?.length, "groups:", data.groups?.length);
    console.log("first group:", JSON.stringify(data.groups?.[0]));
  });
});
