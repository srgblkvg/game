"use strict";
// Общие данные квестов — используется и роутами, и websocket (serverTick)
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_REWARDS = exports.DIFFICULTIES = exports.QUEST_INFO = exports.QUEST_TYPES = void 0;
exports.getToday = getToday;
exports.getMidnightTS = getMidnightTS;
exports.getSnapshot = getSnapshot;
exports.getProgress = getProgress;
exports.QUEST_TYPES = ['hunt', 'arena', 'job', 'craft', 'auction'];
exports.QUEST_INFO = {
    hunt: { name: 'Крысиный мор', icon: '🗡️', desc: (r, d) => `Убить ${r} мобов` },
    arena: { name: 'Первая кровь', icon: '⚔️', desc: (r, d) => `Одержать ${r} PvP-побед` },
    job: { name: 'Медяки в карман', icon: '🌍', desc: (r, d) => {
            if (d === 'easy')
                return 'Провести 15 минут на работах';
            if (d === 'medium')
                return 'Провести 1.5 часа на работах';
            return 'Провести 5 часов на работах';
        } },
    craft: { name: 'Проба пера', icon: '⚒️', desc: (r, d) => `Создать или улучшить ${r} предметов` },
    auction: { name: 'Ставка сделана', icon: '💰', desc: (r, d) => `Совершить ${r} сделок на аукционе` },
};
exports.DIFFICULTIES = {
    easy: { label: '⭐ Простой', rewardXpMult: 1, rewardMoneyMult: 1, req: { hunt: 5, arena: 2, job: 900, craft: 2, auction: 2 } },
    medium: { label: '⭐⭐ Средний', rewardXpMult: 2, rewardMoneyMult: 5, req: { hunt: 25, arena: 8, job: 5400, craft: 5, auction: 5 } },
    hard: { label: '⭐⭐⭐ Сложный', rewardXpMult: 3, rewardMoneyMult: 10, req: { hunt: 100, arena: 35, job: 18000, craft: 10, auction: 10 } },
};
exports.BASE_REWARDS = {
    hunt: { xp: 10, money: 30 }, arena: { xp: 15, money: 40 },
    job: { xp: 8, money: 20 }, craft: { xp: 10, money: 25 }, auction: { xp: 12, money: 50 },
};
async function getToday() {
    return new Date().toISOString().slice(0, 10);
}
async function getMidnightTS() {
    const d = new Date();
    d.setUTCHours(24, 0, 0, 0);
    return Math.floor(d.getTime() / 1000);
}
const index_1 = require("../db/index");
async function getSnapshot(userId) {
    const u = await index_1.db.one('SELECT pveWins, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?', [userId]);
    return {
        pve: u?.pveWins || 0,
        pvpWins: u?.wins || 0,
        craft: u?.craftCount || 0,
        auction: u?.auctionTrades || 0,
        jobSec: u?.totalJobSeconds || 0,
    };
}
async function getProgress(userId, snapshot, questType) {
    const u = await index_1.db.one('SELECT pveWins, wins, craftCount, auctionTrades, totalJobSeconds FROM users WHERE id = ?', [userId]);
    const s = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
    switch (questType) {
        case 'hunt': return (u?.pveWins || 0) - (s.pve || 0);
        case 'arena': return (u?.wins || 0) - (s.pvpWins || 0);
        case 'craft': return (u?.craftCount || 0) - (s.craft || 0);
        case 'auction': return (u?.auctionTrades || 0) - (s.auction || 0);
        case 'job': return (u?.totalJobSeconds || 0) - (s.jobSec || 0);
        default: return 0;
    }
}
//# sourceMappingURL=questData.js.map