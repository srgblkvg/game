import { CharStats, GameItem } from './stats';
export interface BattleStep {
    type: 'attack' | 'dodge' | 'counter' | 'block' | 'fullBlock' | 'crit' | 'stun' | 'damage' | 'info' | 'end' | 'money';
    actor?: 'attacker' | 'defender';
    target?: 'attacker' | 'defender';
    message: string;
    damage?: number;
    amount?: number;
    hp1?: number;
    hp2?: number;
    maxHp1?: number;
    maxHp2?: number;
    stats1?: any;
    stats2?: any;
}
interface BattleResult {
    winnerId: number;
    log: string[];
    steps: BattleStep[];
    attackerHpAfter: number;
    defenderHpAfter: number;
    expGained: number;
    moneyGained: number;
    moneyStolen: number;
}
export declare function dodgeChance(defStats: CharStats, atkStats: CharStats): number;
export declare function critChance(stats: CharStats): number;
export declare function critMult(stats: CharStats): number;
export declare function blockChance(defStats: CharStats): number;
export declare function blockReduction(defStats: CharStats, atkStats: CharStats): number;
export declare function counterChance(defStats: CharStats, atkStats: CharStats, extraBonus: number): number;
export declare function stunChance(atkStats: CharStats, defStats: CharStats): number;
export declare function rollDamage(stats: CharStats, level: number): number;
export interface TurnContext {
    actorName: string;
    targetName: string;
    actorStats: CharStats;
    targetStats: CharStats;
    actorLevel: number;
    hpActor: number;
    hpTarget: number;
    maxHpActor: number;
    maxHpTarget: number;
    actor: 'attacker' | 'defender';
    target: 'attacker' | 'defender';
    antiDodge?: number;
    antiCrit?: number;
    antiBlock?: number;
    antiCounter?: number;
    antiVampiric?: number;
    targetAntiVampiric?: number;
}
export declare function runTurn(ctx: TurnContext, addStep: (s: BattleStep) => void): {
    hpActor: number;
    hpTarget: number;
    stunnedTarget: boolean;
    poisonApplied: {
        damage: number;
        turns: number;
    } | undefined;
};
export declare function runBattle(attacker: {
    id: number;
    name: string;
    base: any;
    equipment: Record<string, GameItem>;
    level: number;
    money: number;
    currentHp?: number;
    drinkBonuses?: any;
    collectionBonus?: number;
    guildBonus?: number;
    stats?: CharStats;
}, defender: {
    id: number;
    name: string;
    base: any;
    equipment: Record<string, GameItem>;
    level: number;
    money: number;
    currentHp?: number;
    drinkBonuses?: any;
    collectionBonus?: number;
    guildBonus?: number;
    stats?: CharStats;
}): BattleResult;
export {};
//# sourceMappingURL=battle.d.ts.map