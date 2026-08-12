import { StatRecord } from '../game/stats';
/** Поля для PvP боя (attacker/defender/arena opponent) */
export declare const USER_BATTLE_FIELDS = "\n  u.id, u.username, u.level, u.exp, u.elo, u.seasonWins, u.seasonLosses,\n  u.baseS, u.baseA, u.baseD, u.baseM,\n  u.equipment, u.equipment_1, u.equipment_2, u.equipment_3, u.active_equip_slot,\n  u.money, u.currentHp, u.lastAttackTime,\n  u.activeDrink, u.drinkUntil, u.premiumUntil,\n  u.protectionUntil, u.roomType, u.roomUntil, u.lastHpUpdate,\n  u.inventorySlots, u.guildId, u.oauthProvider, u.oauthId, u.faction, u.bandit_reputation, u.tutorial_step, u.tutorial_completed\n";
/** Поля с присоединением гильдии */
export declare const USER_BATTLE_FIELDS_GUILD = "\n  \n  u.id, u.username, u.level, u.exp, u.elo, u.seasonWins, u.seasonLosses,\n  u.baseS, u.baseA, u.baseD, u.baseM,\n  u.equipment, u.equipment_1, u.equipment_2, u.equipment_3, u.active_equip_slot,\n  u.money, u.currentHp, u.lastAttackTime,\n  u.activeDrink, u.drinkUntil, u.premiumUntil,\n  u.protectionUntil, u.roomType, u.roomUntil, u.lastHpUpdate,\n  u.inventorySlots, u.guildId, u.oauthProvider, u.oauthId, u.faction, u.bandit_reputation, u.tutorial_step, u.tutorial_completed\n, g.name as guildName\n";
/** Поля для арены (добавляет arenaOpponentId, убирает exp и лишнее) */
export declare const USER_ARENA_FIELDS_GUILD = "\n  u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses,\n  u.equipment, u.equipment_1, u.equipment_2, u.equipment_3, u.active_equip_slot,\n  u.baseS, u.baseA, u.baseD, u.baseM, u.money,\n  u.currentHp, u.lastHpUpdate, u.roomType, u.roomUntil, u.premiumUntil,\n  u.inventorySlots, u.lastAttackTime, u.arenaOpponentId,\n  u.activeDrink, u.drinkUntil, u.guildId,\n  u.gender, u.avatar, u.faction, g.name as guildName\n";
export declare function getUserById(userId: number): Promise<any>;
export declare function getUserWithStats(userId: number): Promise<any>;
export declare function getBaseStats(user: any): StatRecord;
export declare function getMaxHp(stats: {
    hp?: number;
} & StatRecord): number;
export declare function parseEquipment(eq?: string | null): Record<string, any>;
export declare function enrichEquipment(equipment: Record<string, any>): Promise<{
    enriched: Record<string, any>;
    changed: boolean;
}>;
export declare function recalcHpOnEquip(currentHp: number, oldMaxHp: number, newMaxHp: number): number;
export declare function transferMoney(fromUserId: number, toUserId: number, amount: number): Promise<boolean>;
export declare function addMoney(userId: number, amount: number): Promise<void>;
export declare function spendMoney(userId: number, amount: number): Promise<boolean>;
export declare function collectGuildTax(userId: number, income: number, source: string): Promise<number>;
import { CharStats } from '../game/stats';
type BattleContext = 'arena' | 'tournament' | 'pve' | 'war_attack' | 'war_defense';
/** Собрать полные статы игрока со ВСЕМИ бонусами — ЕДИНСТВЕННОЕ место */
export declare function buildPlayerStats(userRow: any, context: BattleContext): Promise<CharStats>;
/** Быстрый расчёт полного бонуса коллекции (предметы + сеты) для одного userId */
export declare function getCollectionBonus(userId: number): Promise<number>;
/**
 * Возвращает JSON-строку для колонки equipment_1 с базовым хлам-шмотом.
 * Все предметы rarity 0 (Хлам), upgradeLevel 0.
 */
export declare function getStarterEquipment(): string;
export declare function expForLevel(level: number): number;
export declare const STAT_POINTS_PER_LEVEL = 5;
export declare function applyExp(userId: number, expGain: number, currentExp: number, currentLevel: number, currentStatPoints: number): {
    newExp: number;
    newLevel: number;
    levelsGained: number;
    newStatPoints: number;
};
export {};
//# sourceMappingURL=helpers.d.ts.map