export interface GameItem {
    id?: string | number;
    name?: string;
    slot: string;
    rarity: number;
    bonuses: {
        s: number;
        a: number;
        d: number;
        m: number;
    };
    extra: {
        stamReg: number;
        crit: number;
        dodge: number;
        counter: number;
        fullBlock: number;
        hpRegen: number;
    };
    upgradeLevel?: number;
}
export interface CharStats {
    s: number;
    a: number;
    d: number;
    m: number;
    v: number;
    hp: number;
    maxStamina: number;
    regen: number;
    attackCost: number;
    bonuses: {
        s: number;
        a: number;
        d: number;
        m: number;
    };
    extra: {
        stamReg: number;
        crit: number;
        dodge: number;
        counter: number;
        fullBlock: number;
        hpRegen: number;
    };
}
export declare function currentStats(base: {
    s: number;
    a: number;
    v: number;
    d: number;
    m: number;
}, equipment: Record<string, GameItem>): CharStats;
export declare function isSlotCompatible(slotId: string, item: GameItem): boolean;
//# sourceMappingURL=stats.d.ts.map