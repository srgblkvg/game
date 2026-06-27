const jwt = require("jsonwebtoken");
const http = require("http");

require("dotenv").config();
const token = jwt.sign({ userId: 31, username: "x", role: "player" }, process.env.JWT_SECRET);

http.get({
  hostname: "localhost", port: 3001,
  path: "/api/floors",
  headers: { Authorization: "Bearer " + token }
}, res => {
  let d = "";
  res.on("data", c => d += c);
  res.on("end", () => {
    const data = JSON.parse(d);
    console.log("floors:", data.floors?.length, "groups:", data.groups?.length);
    console.log("first group:", JSON.stringify(data.groups?.[0]));
  });
});