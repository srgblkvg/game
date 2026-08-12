declare const router: import("express-serve-static-core").Router;
declare const GUILD_QUEST_TYPES: readonly ["pve", "pvp", "craft", "donate", "jobs"];
type GuildQuestType = typeof GUILD_QUEST_TYPES[number];
/** Обновить прогресс активного квеста гильдии и разослать по WS.
 *  questType — тип квеста (pve/pvp/craft/donate/jobs). Инкремент только если совпадает.
 *  increment — на сколько увеличить прогресс (по умолчанию 1). */
export declare function updateGuildQuestProgress(guildId: number, questType: GuildQuestType, increment?: number): Promise<any>;
export default router;
//# sourceMappingURL=guildQuests.d.ts.map