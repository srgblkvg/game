export declare const QUEST_TYPES: readonly ["hunt", "arena", "job", "craft", "auction"];
export type QuestType = typeof QUEST_TYPES[number];
export declare const QUEST_INFO: Record<QuestType, {
    name: string;
    icon: string;
    desc: (req: number, diff: string) => string;
}>;
export declare const DIFFICULTIES: {
    readonly easy: {
        readonly label: "⭐ Простой";
        readonly rewardXpMult: 1;
        readonly rewardMoneyMult: 1;
        readonly req: {
            readonly hunt: 5;
            readonly arena: 2;
            readonly job: 900;
            readonly craft: 2;
            readonly auction: 2;
        };
    };
    readonly medium: {
        readonly label: "⭐⭐ Средний";
        readonly rewardXpMult: 2;
        readonly rewardMoneyMult: 5;
        readonly req: {
            readonly hunt: 25;
            readonly arena: 8;
            readonly job: 5400;
            readonly craft: 5;
            readonly auction: 5;
        };
    };
    readonly hard: {
        readonly label: "⭐⭐⭐ Сложный";
        readonly rewardXpMult: 3;
        readonly rewardMoneyMult: 10;
        readonly req: {
            readonly hunt: 100;
            readonly arena: 35;
            readonly job: 18000;
            readonly craft: 10;
            readonly auction: 10;
        };
    };
};
export type DiffKey = keyof typeof DIFFICULTIES;
export declare const BASE_REWARDS: Record<QuestType, {
    xp: number;
    money: number;
}>;
export declare function getToday(): Promise<string>;
export declare function getMidnightTS(): Promise<number>;
export declare function getSnapshot(userId: number): Promise<Record<string, number>>;
export declare function getProgress(userId: number, snapshot: any, questType: QuestType): Promise<number>;
//# sourceMappingURL=questData.d.ts.map