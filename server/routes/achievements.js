"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAchievement = checkAchievement;
exports.setAchievementProgress = setAchievementProgress;
exports.trackIncome = trackIncome;
const express_1 = require("express");
const index_1 = require("../db/index");
const achievements_1 = require("../game/achievements");
const router = (0, express_1.Router)();
async function checkAchievement(userId, trackKey, increment = 1) {
    const track = achievements_1.TRACK_MAP.get(trackKey);
    if (!track)
        return null;
    // Upsert progress
    await index_1.db.run(`INSERT INTO user_achievements (user_id, track, progress, highest_tier, achieved_at)
         VALUES ($1, $2, $3, 0, '{}'::jsonb)
         ON CONFLICT (user_id, track) DO UPDATE SET progress = user_achievements.progress + $4`, [userId, trackKey, increment, increment]);
    const row = await index_1.db.one('SELECT progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1 AND track = $2', [userId, trackKey]);
    const progress = row.progress || 0;
    const highestTier = row.highest_tier || 0;
    const currentTier = (0, achievements_1.getTrackTier)(track, progress);
    if (currentTier && currentTier.tier > highestTier) {
        // Award new tier
        const achievedAt = row.achieved_at || {};
        achievedAt[String(currentTier.tier)] = new Date().toISOString();
        await index_1.db.run('UPDATE user_achievements SET highest_tier = $1, achieved_at = $2 WHERE user_id = $3 AND track = $4', [currentTier.tier, JSON.stringify(achievedAt), userId, trackKey]);
        return {
            newTier: currentTier.tier,
            trackName: track.name,
            tierIcon: currentTier.icon,
            tierName: currentTier.name,
        };
    }
    return null;
}
// Set achievement progress to an absolute value (not increment) — for tracks like level
async function setAchievementProgress(userId, trackKey, value) {
    const track = achievements_1.TRACK_MAP.get(trackKey);
    if (!track)
        return;
    // Upsert with SET progress = value
    await index_1.db.run(`INSERT INTO user_achievements (user_id, track, progress, highest_tier, achieved_at)
         VALUES ($1, $2, $3, 0, '{}'::jsonb)
         ON CONFLICT (user_id, track) DO UPDATE SET progress = $3`, [userId, trackKey, value]);
    const row = await index_1.db.one('SELECT progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1 AND track = $2', [userId, trackKey]);
    const progress = row.progress || 0;
    const highestTier = row.highest_tier || 0;
    const currentTier = (0, achievements_1.getTrackTier)(track, progress);
    if (currentTier && currentTier.tier > highestTier) {
        const achievedAt = row.achieved_at || {};
        achievedAt[String(currentTier.tier)] = new Date().toISOString();
        await index_1.db.run('UPDATE user_achievements SET highest_tier = $1, achieved_at = $2 WHERE user_id = $3 AND track = $4', [currentTier.tier, JSON.stringify(achievedAt), userId, trackKey]);
    }
}
// Get all achievements for a user
router.get('/achievements', async (req, res) => {
    const userId = req.userId;
    const rows = await index_1.db.query('SELECT track, progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1', [userId]);
    const result = [];
    for (const track of achievements_1.ACHIEVEMENT_TRACKS) {
        const row = rows.find(r => r.track === track.key);
        const progress = row?.progress || 0;
        const highestTier = row?.highest_tier || 0;
        const currentTier = (0, achievements_1.getTrackTier)(track, progress);
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
    if (!targetId)
        return res.status(400).json({ error: 'Invalid user ID' });
    const rows = await index_1.db.query('SELECT track, progress, highest_tier, achieved_at FROM user_achievements WHERE user_id = $1 AND highest_tier > 0', [targetId]);
    const result = [];
    for (const track of achievements_1.ACHIEVEMENT_TRACKS) {
        const row = rows.find(r => r.track === track.key);
        const progress = row?.progress || 0;
        const highestTier = row?.highest_tier || 0;
        if (highestTier === 0)
            continue; // Skip unearned
        const currentTier = (0, achievements_1.getTrackTier)(track, progress);
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
    const totalScore = result.reduce((sum, a) => sum + a.highestTier, 0);
    res.json({ achievements: result, score: totalScore });
});
// Track income (called from income sources, excluding donations/transfers)
async function trackIncome(userId, amount) {
    if (amount <= 0)
        return;
    await index_1.db.run('UPDATE users SET total_income = total_income + $1 WHERE id = $2', [amount, userId]);
    // Check achievement
    await checkAchievement(userId, 'income', amount);
}
exports.default = router;
//# sourceMappingURL=achievements.js.map