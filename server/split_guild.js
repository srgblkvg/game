const fs = require("fs");
const src = fs.readFileSync("src/routes/guild.ts", "utf8");
const lines = src.split("\n");
console.log("Total lines:", lines.length);
console.log("Line 10:", lines[9].substring(0, 60));
console.log("Line 150:", lines[149] ? lines[149].substring(0, 60) : "MISSING");
const dir = "src/routes/guild";
fs.mkdirSync(dir, { recursive: true });

function write(name, ranges) {
  let body = ranges.map(([s, e]) => lines.slice(s-1, e).join("\n")).join("\n");
  console.log(`  ${name}: body ${body.length} chars, ${body.split("\\n").length} lines from ${JSON.stringify(ranges)}`);
  const content = imports[name] + body + "\n\nexport default router;\n";
  const path = `${dir}/${name}.ts`;
  fs.writeFileSync(path, content);
  console.log(`  -> ${path} (${content.split("\\n").length} total lines)`);
}

const imports = {
  guildCore: `import { Router } from "express";
import { db } from "../../db/index";

const router = Router();

`,
  guildMembers: `import { Router } from "express";
import { db } from "../../db/index";
import { broadcast } from "../../events";

const router = Router();

`,
  guildChat: `import { Router } from "express";
import { db } from "../../db/index";
import { broadcast } from "../../events";

const router = Router();

`,
  guildTreasury: `import { Router } from "express";
import { db } from "../../db/index";

const router = Router();

`,
  guildWar: `import { Router } from "express";
import { db } from "../../db/index";
import { broadcast, sendToGuild } from "../../events";
import { getDrinkBonuses } from "../../game/drinks";
import { runBattle } from "../../game/battle";
import { getBaseStats, enrichEquipment } from "../../db/helpers";
import { getGuildBonus } from "../../game/guildBuildings";

const router = Router();

`,
  guildQuests: `import { Router } from "express";
import { db } from "../../db/index";
import { sendToGuild } from "../../events";

const router = Router();

`,
};

write("guildCore", [[10,150], [234,267], [435,456]]);
write("guildMembers", [[151,180], [268,434], [457,506]]);
write("guildChat", [[181,233]]);
write("guildTreasury", [[510,577], [987,1000]]);
write("guildWar", [[579,630], [631,986]]);
write("guildQuests", [[1001, lines.length]]);

// New guild.ts — write LAST
const newGuild = `import { Router } from "express";
import guildCore from "./guild/guildCore";
import guildMembers from "./guild/guildMembers";
import guildChat from "./guild/guildChat";
import guildTreasury from "./guild/guildTreasury";
import guildWar from "./guild/guildWar";
import guildQuests from "./guild/guildQuests";

const router = Router();
router.use(guildCore);
router.use(guildMembers);
router.use(guildChat);
router.use(guildTreasury);
router.use(guildWar);
router.use(guildQuests);

export { updateGuildQuestProgress } from "./guild/guildQuests";
export default router;
`;
fs.writeFileSync("src/routes/guild.ts", newGuild);
console.log("New guild.ts written");
