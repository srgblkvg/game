import { Router } from 'express';
import { db } from '../db/index';
import { ACHIEVEMENT_TRACKS, getTrackTier, TRACK_MAP } from '../game/achievements';

const router = Router();

export async function checkAchievement(userId: number, trackKey: string, increment: number = 1): Promise<{
    newTier: number | null;
    trackName: string;
    tierIcon: string;
    tierName: string;
} | null> {
    const track = TRACK_MAP.get(trackKey);
    if (!track) return null;

    // Upsert progress
    await db.run(
        `INSERT INTO user_achievements (user_id, track, progress, highest_tier, achieved_at)
         VALUES ($1, $2, $3, 0, '{}'::jsonb)
         ON CONFLICT (user_id, track) DO UPDATE SET progress = user_achievements.progress + $4`,
        [userId, trackKey, increment, increment]
    );

    const row = await db.one(
        'SELECT progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1 AND track = $2',
        [userId, trackKey]
    ) as any;

    const progress = row.progress || 0;
    const highestTier = row.highest_tier || 0;

    const currentTier = getTrackTier(track, progress);
    if (currentTier && currentTier.tier > highestTier) {
        // Award new tier
        const achievedAt = row.achieved_at || {};
        achievedAt[String(currentTier.tier)] = new Date().toISOString();
        await db.run(
            'UPDATE user_achievements SET highest_tier = $1, achieved_at = $2 WHERE user_id = $3 AND track = $4',
            [currentTier.tier, JSON.stringify(achievedAt), userId, trackKey]
        );

        return {
            newTier: currentTier.tier,
            trackName: track.name,
            tierIcon: currentTier.icon,
            tierName: currentTier.name,
        };
    }
    return null;
}

// Get all achievements for a user
router.get('/achievements', async (req, res) => {
    const userId = req.userId;
    const rows = await db.query(
        'SELECT track, progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1',
        [userId]
    ) as any[];

    const result: any[] = [];
    for (const track of ACHIEVEMENT_TRACKS) {
        const row = rows.find(r => r.track === track.key);
        const progress = row?.progress || 0;
        const highestTier = row?.highest_tier || 0;
        const currentTier = getTrackTier(track, progress);

        result.push({
            key: track.key,
            name: track.name,
            icon: track.icon,
            description: track.description,
            progress,
            highestTier,
            currentTier: currentTier ? {
                tier: currentTier.tier,
                name: currentTier.name,
                icon: currentTier.icon,
            } : null,
            tiers: track.tiers.map(t => ({
                ...t,
                achieved: t.tier <= highestTier,
                current: currentTier?.tier === t.tier,
            })),
            achievedAt: row?.achieved_at || {},
        });
    }

    res.json(result);
});

// Get user achievements (public — for profile)
router.get('/achievements/:userId', async (req, res) => {
    const targetId = parseInt(req.params.userId);
    if (!targetId) return res.status(400).json({ error: 'Invalid user ID' });

    const rows = await db.query(
        'SELECT track, progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1 AND highest_tier > 0',
        [targetId]
    ) as any[];

    const result: any[] = [];
    for (const track of ACHIEVEMENT_TRACKS) {
        const row = rows.find(r => r.track === track.key);
        const progress = row?.progress || 0;
        const highestTier = row?.highest_tier || 0;
        if (highestTier === 0) continue; // Skip unearned

        const currentTier = getTrackTier(track, progress);
        result.push({
            key: track.key,
            name: track.name,
            icon: track.icon,
            progress,
            highestTier,
            currentTier: currentTier ? {
                tier: currentTier.tier,
                name: currentTier.name,
                icon: currentTier.icon,
            } : null,
            tiers: track.tiers.map(t => ({
                tier: t.tier,
                name: t.name,
                icon: t.icon,
                threshold: t.threshold,
            })),
        });
    }

    res.json(result);
});

// Track income (called from income sources, excluding donations/transfers)
export async function trackIncome(userId: number, amount: number): Promise<void> {
    if (amount <= 0) return;
    await db.run('UPDATE users SET total_income = total_income + $1 WHERE id = $2', [amount, userId]);
    // Check achievement
    await checkAchievement(userId, 'income', amount);
}

export default router;
