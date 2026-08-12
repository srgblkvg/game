declare const router: import("express-serve-static-core").Router;
export declare function checkAchievement(userId: number, trackKey: string, increment?: number): Promise<{
    newTier: number | null;
    trackName: string;
    tierIcon: string;
    tierName: string;
} | null>;
export declare function setAchievementProgress(userId: number, trackKey: string, value: number): Promise<void>;
export declare function trackIncome(userId: number, amount: number): Promise<void>;
export default router;
//# sourceMappingURL=achievements.d.ts.map