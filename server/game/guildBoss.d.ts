export declare const BOSS_BASE_HP = 100000;
export declare const BOSS_BASE_STATS: {
    s: number;
    a: number;
    d: number;
    m: number;
};
export declare const BOSS_BASE_LEVEL = 20;
export declare const BOSS_HP_PER_KILL = 50000;
export declare const BOSS_STAT_SCALE = 0.1;
export declare const BOSS_LEVEL_PER_KILL = 5;
export declare const BOSS_COOLDOWN = 3600;
export declare const BOSS_RESPAWN_DELAY = 300;
/** Сжать эффекты босса в плоский объект для Object.assign в бою */
export declare function flattenBossEffects(effects: {
    name: string;
    effect: Record<string, any>;
}[]): Record<string, any>;
export declare const TALENT_TYPES: readonly ["accuracy", "fortitude", "penetration", "control", "vampiric"];
export type TalentType = typeof TALENT_TYPES[number];
export declare const TALENT_LABELS: Record<TalentType, string>;
export declare const TALENT_DESCS: Record<TalentType, string>;
/** Стоимость прокачки таланта: 10 * 2^currentLevel */
export declare function getTalentUpgradeCost(currentLevel: number): number;
export interface BossStats {
    s: number;
    a: number;
    d: number;
    m: number;
    hp: number;
    level: number;
    killCount: number;
}
export declare function getBossStats(killCount: number): BossStats;
export declare function getOrCreateBoss(guildId: number): Promise<{
    currentHp: number;
    maxHp: number;
    atk: number;
    agi: number;
    def: number;
    mst: number;
    level: number;
    killCount: number;
    effects: {
        name: string;
        effect: Record<string, any>;
    }[];
    respawnAt: number;
}>;
export declare function damageBoss(guildId: number, damage: number): Promise<{
    killed: boolean;
    newKillCount: number;
    respawnAt?: number;
}>;
export declare function getGuildTalents(guildId: number): Promise<Record<string, {
    level: number;
    progress: number;
}>>;
export declare function getPlayerTalents(userId: number, guildId: number): Promise<Record<string, {
    level: number;
    progress: number;
}>>;
/** Суммарный контр-бонус от личных + гильдийских талантов */
export declare function getTalentAntiBonus(playerTalents: Record<string, {
    level: number;
    progress: number;
}>, guildTalents: Record<string, {
    level: number;
    progress: number;
}>, talentType: TalentType): number;
/** Получить все поля anti-* для передачи в TurnContext */
export declare function getAntiStats(playerTalents: Record<string, {
    level: number;
    progress: number;
}>, guildTalents: Record<string, {
    level: number;
    progress: number;
}>): {
    antiDodge: number;
    antiCrit: number;
    antiBlock: number;
    antiCounter: number;
    antiVampiric: number;
};
//# sourceMappingURL=guildBoss.d.ts.map