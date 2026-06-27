const fs = require("fs");
const src = fs.readFileSync("src/routes/mobs.ts", "utf8");
const lines = src.split("\n");
const dir = "src/routes/mobs";
fs.mkdirSync(dir, { recursive: true });

// mobsData.ts: imports + helpers (lines 1-52)
// Skip lines 11 (router) and strip export default at end
// Fix paths for subdirectory
let dataLines = lines.slice(0, 10);  // original imports
let dataBody = dataLines.map(l => l.replace("from '../", "from '../../").replace("from './", "from '../")).join("\n") + "\n" + lines.slice(13, 52).join("\n");
let dataFile = dataBody + `

export { getItemDropTable };
`;
fs.writeFileSync(`${dir}/mobsData.ts`, dataFile);
console.log("Data:", dataFile.split("\n").length, "lines");

// mobsRoutes.ts: route handlers (lines 53-436)
let routesBody = `import { Router } from "express";
import { db } from "../../db/index";
import { getBaseStats, enrichEquipment, collectGuildTax, applyExp, buildPlayerStats } from "../../db/helpers";
import { currentStats } from "../../game/stats";
import { addPveRating } from "../../game/rating";
import { getDrinkBonuses } from "../../game/drinks";
import { updateGuildQuestProgress } from "../guild";
import { markDirty } from "../../events";
import { getGuildBonus } from "../../game/guildBuildings";
import { getItemDropTable } from "./mobsData";

const router = Router();

` + lines.slice(52, lines.length - 2).join("\n") + `

export default router;
`;
fs.writeFileSync(`${dir}/mobsRoutes.ts`, routesBody);
console.log("Routes:", routesBody.split("\n").length, "lines");

// New mobs.ts
fs.writeFileSync("src/routes/mobs.ts", `import mobsRoutes from "./mobs/mobsRoutes";
export default mobsRoutes;
`);
console.log("Main: 2 lines");
