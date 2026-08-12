declare const BUILDINGS: {
    readonly training_ground: {
        readonly name: "Тренировочная площадка";
        readonly icon: "🏟️";
        readonly desc: "Характеристики на арене и турнирах";
        readonly bonusPerLevel: 5;
        readonly appliesTo: readonly ["arena", "tournament"];
    };
    readonly scout_hq: {
        readonly name: "Штаб разведки";
        readonly icon: "🔭";
        readonly desc: "Характеристики против монстров";
        readonly bonusPerLevel: 5;
        readonly appliesTo: readonly ["pve"];
    };
    readonly siege_camp: {
        readonly name: "Осадный лагерь";
        readonly icon: "⚔️";
        readonly desc: "Характеристики при атаке в войне гильдий";
        readonly bonusPerLevel: 5;
        readonly appliesTo: readonly ["war_attack"];
    };
    readonly walls: {
        readonly name: "Стены";
        readonly icon: "🏰";
        readonly desc: "Характеристики при защите в войне гильдий";
        readonly bonusPerLevel: 5;
        readonly appliesTo: readonly ["war_defense"];
    };
};
type Context = 'arena' | 'tournament' | 'pve' | 'war_attack' | 'war_defense';
export type BuildingType = keyof typeof BUILDINGS;
export declare function getBuildingCost(level: number): number;
export declare function getBuildingReqLevel(level: number): number;
/** Получить бонус гильдейских сооружений для пользователя в данном контексте */
export declare function getGuildBonus(userId: number, context: Context): Promise<number>;
export { BUILDINGS };
/** Получить ВСЕ сооружения (построенные + доступные для постройки) */
export declare function getGuildBuildings(userId: number): Promise<{
    type: string;
    icon: "🏟️" | "🔭" | "⚔️" | "🏰";
    label: "Тренировочная площадка" | "Штаб разведки" | "Осадный лагерь" | "Стены";
    desc: "Характеристики на арене и турнирах" | "Характеристики против монстров" | "Характеристики при атаке в войне гильдий" | "Характеристики при защите в войне гильдий";
    level: number;
    bonus: number;
    nextBonus: 5;
    cost: number;
    reqLevel: number;
    canBuild: boolean;
}[]>;
/** Построить/улучшить сооружение */
export declare function buildBuilding(userId: number, buildingType: BuildingType): Promise<{
    success: boolean;
    buildingType: "training_ground" | "scout_hq" | "siege_camp" | "walls";
    level: any;
    cost: number;
}>;
//# sourceMappingURL=guildBuildings.d.ts.map