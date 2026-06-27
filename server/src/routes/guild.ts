import { Router } from "express";
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
export { isGuildAtWar } from "./guild/guildWar";
export default router;
