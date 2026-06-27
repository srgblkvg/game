import re, os

with open("/mnt/c/project/game/server/src/routes/guild.ts") as f:
    content = f.read()

lines = content.split("\n")

sections = {}
for i, l in enumerate(lines):
    s = l.strip()
    if s == "// Создать гильдию": sections["core"] = i
    if s == "// Заявки на вступление (для лидера/офицеров)": sections["members"] = i
    if s == "// --- Гильд-чат ---": sections["chat"] = i
    if s == "// --- Казна гильдии ---": sections["treasury"] = i
    if s == "// --- Гильд-войны ---": sections["war"] = i
    if l.strip().startswith("router.get('/guild/quest'"): sections["quests"] = i
    if s.startswith("async function isGuildAtWar"): sections["war_helper"] = i
    if s.startswith("export async function updateGuildQuestProgress"): sections["quest_helper"] = i
    if s == "export default router;": sections["end"] = i

for k, v in sorted(sections.items(), key=lambda x: x[1]):
    print(f"  {k}: {v}")

dir_path = "/mnt/c/project/game/server/src/routes/guild"
os.makedirs(dir_path, exist_ok=True)

def save_section(name, start, end, extra_imports=""):
    section_lines = lines[start:end]
    section = "\n".join(section_lines)
    content = f'''import {{ Router }} from "express";
import {{ db }} from "../../db/index";
{extra_imports}
const router = Router();

{section}

export default router;
'''
    path = f"{dir_path}/{name}.ts"
    with open(path, "w") as f:
        f.write(content)
    print(f"  Wrote {name}.ts: {len(section_lines)} lines")

save_section("guildCore", sections["core"], sections["members"])
save_section("guildMembers", sections["members"], sections["chat"])
save_section("guildChat", sections["chat"], sections["treasury"], 'import { broadcast } from "../../events";')
save_section("guildTreasury", sections["treasury"], sections["war"])
save_section("guildWar", sections["war"], sections["quests"], 
    'import { getDrinkBonuses } from "../../game/drinks";\nimport { runBattle } from "../../game/battle";\nimport { getBaseStats, enrichEquipment } from "../../db/helpers";\nimport { getGuildBonus } from "../../game/guildBuildings";')
save_section("guildQuests", sections["quests"], sections["end"])

# Write new guild.ts
new_guild = '''import { Router } from "express";
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

export default router;
'''

with open("/mnt/c/project/game/server/src/routes/guild.ts", "w") as f:
    f.write(new_guild)
print("Wrote new guild.ts")
