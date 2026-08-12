"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobCompletionScheduler = startJobCompletionScheduler;
// Авто-завершение работ: проверяет активные работы и начисляет награду
const index_1 = require("../db/index");
const events_1 = require("../events");
function startJobCompletionScheduler() {
    setInterval(async () => {
        try {
            const now = Math.floor(Date.now() / 1000);
            // Найти работы с истекшим сроком
            const completed = await index_1.db.query(`SELECT id, username, activejob, exp, level, statpoints, money, guildid, oauthprovider, oauthid
         FROM users WHERE activejob IS NOT NULL AND id > 0`, []);
            for (const user of completed) {
                let jobData;
                try {
                    jobData = JSON.parse(user.activejob);
                }
                catch {
                    continue;
                }
                if (!jobData || now < jobData.endTime)
                    continue;
                // Применить опыт
                const { applyExp, collectGuildTax } = await Promise.resolve().then(() => __importStar(require('../db/helpers')));
                const { updateGuildQuestProgress } = await Promise.resolve().then(() => __importStar(require('../routes/guild/guildQuests')));
                const taxedReward = await collectGuildTax(user.id, jobData.reward, 'tax_job');
                const { newExp, newLevel, levelsGained, newStatPoints } = applyExp(user.id, jobData.expReward || 0, user.exp, user.level, user.statpoints || 0);
                const finalMoney = user.money - jobData.reward + taxedReward;
                await index_1.db.run('UPDATE users SET money = ?, exp = ?, level = ?, statpoints = ?, activejob = NULL, totaljobmoney = totaljobmoney + ?, totaljobseconds = totaljobseconds + ? WHERE id = ?', [finalMoney, newExp, newLevel, newStatPoints, jobData.reward, jobData.duration, user.id]);
                await index_1.db.run('INSERT INTO job_history (userid, jobid, jobname, duration, reward, startedat, premiumbonus, xpgained) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [user.id, jobData.jobId, jobData.name, jobData.duration, jobData.reward,
                    new Date(jobData.startTime * 1000).toISOString(), jobData.premiumBonus || 0, jobData.expReward || 0]);
                // VK Leaderboard
                if (levelsGained > 0 && user.oauthprovider === 'vk' && user.oauthid) {
                    const { sendLeaderboardLevel } = await Promise.resolve().then(() => __importStar(require('../vkLeaderboard')));
                    sendLeaderboardLevel(user.id, newLevel, String(user.oauthid)).catch(() => { });
                }
                // Guild quest
                if (user.guildid) {
                    updateGuildQuestProgress(user.guildid, 'jobs', jobData.duration)
                        .catch((e) => console.error('guildQuest jobs:', e.message));
                }
                // Уведомление
                (0, events_1.pushNotification)(user.id, {
                    type: 'system',
                    message: `Работа «${jobData.name}» завершена! +${taxedReward} серебра, +${(jobData.expReward || 0)} XP`,
                });
                (0, events_1.markDirty)(user.id, 'quests');
            }
        }
        catch (e) {
            console.error('Job completion scheduler error:', e.message);
        }
    }, 30000); // каждые 30 секунд
}
//# sourceMappingURL=jobs.js.map