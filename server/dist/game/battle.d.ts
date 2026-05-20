import { GameItem } from './stats';
export interface BattleStep {
    type: 'attack' | 'dodge' | 'counter' | 'block' | 'fullBlock' | 'crit' | 'stun' | 'damage' | 'info' | 'end' | 'money' | 'stamina';
    actor?: 'attacker' | 'defender';
    target?: 'attacker' | 'defender';
    message: string;
    damage?: number;
    amount?: number;
    stamina?: number;
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
export declare function runBattle(attacker: {
    id: number;
    name: string;
    base: any;
    equipment: Record<string, GameItem>;
    level: number;
    money: number;
}, defender: {
    id: number;
    name: string;
    base: any;
    equipment: Record<string, GameItem>;
    level: number;
    money: number;
}): BattleResult;
export {};
//# sourceMappingURL=battle.d.ts.map