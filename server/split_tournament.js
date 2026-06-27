const fs = require("fs");
const src = fs.readFileSync("src/routes/tournament.ts", "utf8");
const lines = src.split("\n");
const dir = "src/routes/tournament";
fs.mkdirSync(dir, { recursive: true });

// Split: helpers (25-480), routes (481-817)
// But routes need the helpers. So tournamentLogic.ts exports the helpers,
// tournamentRoutes.ts imports them and defines the routes,
// tournament.ts imports tournamentRoutes.

// tournamentLogic.ts: helper functions
let logic = `import { db, pool } from "../../db/index";
import { runBattle } from "../../game/battle";
import { getGuildBonus } from "../../game/guildBuildings";
import { getBaseStats, enrichEquipment, buildPlayerStats, addMoney } from "../../db/helpers";
import { getDrinkBonuses } from "../../game/drinks";

` + lines.slice(9, 480).join("\n") + `

export { nextPowerOfTwo, generateBracket, loadPlayerForBattle, resolveCurrentRound, advanceWinners, finishTournament };
`;
fs.writeFileSync(`${dir}/tournamentLogic.ts`, logic);
console.log("Logic:", logic.split("\n").length, "lines");

// tournamentRoutes.ts: route handlers + imports of helpers
const routes = `import { Router } from "express";
import { db } from "../db/index";
import { runBattle } from "../game/battle";
import {
  nextPowerOfTwo, generateBracket, loadPlayerForBattle,
  resolveCurrentRound, advanceWinners, finishTournament,
} from "./tournamentLogic";

const router = Router();

` + lines.slice(480, lines.length - 1).join("\n") + `

export default router;
`;
fs.writeFileSync(`${dir}/tournamentRoutes.ts`, routes);
console.log("Routes:", routes.split("\n").length, "lines");

// New tournament.ts
const newMain = `import tournamentRoutes from "./tournament/tournamentRoutes";
export default tournamentRoutes;
`;
fs.writeFileSync("src/routes/tournament.ts", newMain);
console.log("Main: 3 lines");
