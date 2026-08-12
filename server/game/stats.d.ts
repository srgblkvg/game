export declare const PRIMARY_STATS: readonly ["s", "a", "d", "m"];
export type PrimaryStat = typeof PRIMARY_STATS[number];
export declare const EXTRA_STATS: readonly ["crit", "dodge", "counter", "fullBlock"];
export type ExtraStat = typeof EXTRA_STATS[number];
export type StatRecord = {
    s: number;
    a: number;
    d: number;
    m: number;
};
export type ExtraRecord = {
    crit: number;
    dodge: number;
    counter: number;
    fullBlock: number;
};
/** HP = S + A + M (защита даёт блок, не HP) */
export declare function sumStats(s: StatRecord): number;
/** Масштабировать все статы на множитель */
export declare function scaleStats(s: StatRecord, mult: number): StatRecord;
/** Сложить два StatRecord */
export declare function addStats(a: StatRecord, b: StatRecord): StatRecord;
/** Сумма extra-статов */
export declare function sumExtra(e: ExtraRecord): number;
declare const F: {
    readonly dodgeDef: "a";
    readonly dodgePen: "m";
    readonly crit: "m";
    readonly block: "d";
    readonly damage: "s";
    readonly counterDef: readonly ["m", "a"];
    readonly counterTgt: readonly ["m", "d"];
    readonly stunAtk: readonly ["s", "m"];
    readonly stunDef: readonly ["s", "d"];
};
declare function sv(stats: CharStats, key: any): number;
export { F, sv };
export interface GameItem {
    id?: string | number;
    name?: string;
    slot: string;
    rarity_id: number;
    bonuses: StatRecord;
    extra: ExtraRecord;
    upgradeLevel?: number;
    curseStat?: string;
    curseValue?: number;
    curseRank?: number;
    curseName?: string;
    curseColor?: string;
}
export interface CharStats extends StatRecord {
    hp: number;
    bonuses: StatRecord;
    extra: ExtraRecord;
    drinks: StatRecord;
    collection: number;
    vampirism?: number;
    rageDmg?: number;
    rageThreshold?: number;
    luckBoost?: number;
    resiliencePct?: number;
    alwaysFirst?: boolean;
    execute?: boolean;
    counterOnHit?: number;
    poisonOnHit?: number;
    blockPen?: number;
    hermitRegen?: boolean;
    setBonuses?: string[];
}
export interface StatSums extends StatRecord {
}
export declare function currentStats(base: StatRecord, equipment: Record<string, GameItem>, drinkBonuses?: StatRecord, collectionBonus?: number, guildBonus?: number): CharStats;
export declare function isSlotCompatible(slotId: string, item: GameItem): boolean;
//# sourceMappingURL=stats.d.ts.map