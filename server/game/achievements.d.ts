export interface AchievementTier {
    tier: number;
    name: string;
    icon: string;
    threshold: number;
}
export interface AchievementTrack {
    key: string;
    name: string;
    icon: string;
    description: string;
    tiers: AchievementTier[];
}
export declare const ACHIEVEMENT_TRACKS: AchievementTrack[];
export declare const TRACK_MAP: Map<string, AchievementTrack>;
export declare function getTrackTier(track: AchievementTrack, progress: number): AchievementTier | null;
export declare function getTrackProgress(tier: AchievementTier | null, next: AchievementTier | undefined): {
    current: number;
    next: number;
    pct: number;
};
//# sourceMappingURL=achievements.d.ts.map