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
// server/src/routes/arena.ts
const express_1 = require("express");
const index_1 = require("../db/index");
const validation_1 = require("../validation");
const helpers_1 = require("../db/helpers");
const router = (0, express_1.Router)();
// Получить случайного соперника (без боя)
router.get('/arena/opponent', async (req, res) => {
    const userId = req.userId;
    const change = req.query.change === 'true';
    const excludeId = req.query.excludeId ? parseInt(req.query.excludeId) : undefined;
    const difficulty = req.query.difficulty || 'equal'; // easy | equal | hard
    const user = await index_1.db.one(`SELECT ${helpers_1.USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?`, [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const now = Math.floor(Date.now() / 1000);
    // Если не смена — проверяем закреплённого соперника
    if (!change && user.arenaOpponentId) {
        const saved = await index_1.db.one(`SELECT ${helpers_1.USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ? AND (u.protectionUntil IS NULL OR u.protectionUntil < ?) AND (u.guildId IS NULL OR u.guildId != ?)`, [user.arenaOpponentId, now, user.guildId || 0]);
        if (saved) {
            // Проверяем, соответствует ли сохранённый соперник запрошенной сложности
            const range = user.faction === 'bandit' ? 4 : 2;
            const matchesDifficulty = (difficulty === 'easy' && saved.level >= user.level - range && saved.level < user.level) ||
                (difficulty === 'hard' && saved.level > user.level && saved.level <= user.level + range) ||
                (difficulty === 'equal' && saved.level === user.level);
            if (matchesDifficulty) {
                // Возвращаем того же соперника — бесплатно
                const savedBase = { s: saved.baseS ?? 5, a: saved.baseA ?? 5, d: saved.baseD ?? 5, m: saved.baseM ?? 5 };
                const savedEquip = JSON.parse(saved.equipment || '{}');
                const { enriched: savedEnriched } = await (0, helpers_1.enrichEquipment)(savedEquip);
                const savedStats = await (0, helpers_1.buildPlayerStats)(saved, 'arena');
                return res.json({
                    id: saved.id, name: saved.username, level: saved.level,
                    equipment: savedEnriched, stats: savedStats,
                    currentHp: saved.currenthp ?? savedStats.hp,
                    playerMoney: user.money,
                    gender: saved.gender || 'male',
                    avatar: saved.avatar || null,
                    faction: saved.faction || null,
                    guildName: saved.guildName || null, guildId: saved.guildId || null,
                });
            }
            // Сложность изменилась — сбрасываем сохранённого соперника, ниже подберём нового (с оплатой)
            if (user.money < 10) {
                return res.status(400).json({ error: 'Недостаточно монет для смены сложности (10 бронзы)' });
            }
            await index_1.db.run('UPDATE users SET money = money - 10 WHERE id = ?', [userId]);
            user.money -= 10;
        }
        // Соперник исчез (удалён/защита) — сбрасываем и подбираем нового ниже
    }
    // Подбор соперников по сложности
    let opponents = await index_1.db.query(`SELECT ${helpers_1.USER_ARENA_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id != ? AND u.id > 0 AND (u.protectionUntil IS NULL OR u.protectionUntil < ?) AND (u.guildId IS NULL OR u.guildId != ?)`, [userId, now, user.guildId || 0]);
    const range = user.faction === 'bandit' ? 4 : 2;
    const diffLabel = difficulty === 'easy' ? `на −${range}..−1 уровня` : difficulty === 'hard' ? `на +1..+${range} уровня` : 'равным вашему';
    if (difficulty === 'easy') {
        opponents = opponents.filter((o) => o.level >= user.level - range && o.level < user.level);
    }
    else if (difficulty === 'hard') {
        opponents = opponents.filter((o) => o.level > user.level && o.level <= user.level + range);
    }
    else {
        opponents = opponents.filter((o) => o.level === user.level);
    }
    if (opponents.length === 0) {
        return res.status(404).json({ error: `Нет соперников с уровнем ${diffLabel} (${user.level})` });
    }
    if (excludeId !== undefined && !isNaN(excludeId)) {
        opponents = opponents.filter((o) => o.id !== excludeId);
    }
    if (change) {
        if (opponents.length === 0) {
            return res.status(400).json({ error: 'Нет других соперников' });
        }
        if (user.money < 10) {
            return res.status(400).json({ error: 'Недостаточно монет для смены (10 бронзы)' });
        }
        await index_1.db.run('UPDATE users SET money = money - 10 WHERE id = ?', [userId]);
        user.money -= 10;
    }
    if (opponents.length === 0) {
        return res.status(404).json({ error: 'Нет доступных соперников' });
    }
    const opponent = opponents[Math.floor(Math.random() * opponents.length)];
    // Запоминаем выбранного соперника
    await index_1.db.run('UPDATE users SET arenaOpponentId = ? WHERE id = ?', [opponent.id, userId]);
    const { enriched: enrichedEquipment } = await (0, helpers_1.enrichEquipment)(JSON.parse(opponent.equipment || '{}'));
    const stats = await (0, helpers_1.buildPlayerStats)(opponent, 'arena');
    // Актуальное HP с офлайн-регеном
    const { applyHpRegen } = await Promise.resolve().then(() => __importStar(require('../game/hpRegen')));
    const actualHp = await applyHpRegen({
        id: opponent.id,
        currentHp: opponent.currentHp ?? stats.hp,
        maxHp: stats.hp,
        lastHpUpdate: opponent.lastHpUpdate || 0,
        roomType: opponent.roomType,
        roomUntil: opponent.roomUntil,
        premiumUntil: opponent.premiumUntil,
    });
    res.json({
        id: opponent.id,
        name: opponent.username,
        level: opponent.level,
        equipment: enrichedEquipment,
        stats,
        currentHp: actualHp,
        playerMoney: user.money,
        gender: opponent.gender || 'male',
        avatar: opponent.avatar || null,
        faction: opponent.faction || null,
        guildName: opponent.guildName || null,
        guildId: opponent.guildId || null,
    });
});
// Вход на арену (платный)
router.post('/arena/enter', async (req, res) => {
    const parsed = validation_1.arenaEnterSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректный запрос' });
    const userId = req.userId;
    const user = await index_1.db.one('SELECT money, guildId FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.money < 10)
        return res.status(400).json({ error: 'Недостаточно монет (нужно 10 бронзы)' });
    const now = Math.floor(Date.now() / 1000);
    const count = (await index_1.db.one('SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?) AND (guildId IS NULL OR guildId != ?)', [userId, now, user.guildId || 0])).cnt;
    if (count === 0)
        return res.status(400).json({ error: 'Нет доступных соперников' });
    await index_1.db.run('UPDATE users SET money = money - 10 WHERE id = ?', [userId]);
    res.json({ success: true });
});
// Проверка наличия соперников
router.get('/arena/check-opponent', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
    const now = Math.floor(Date.now() / 1000);
    const count = (await index_1.db.one('SELECT COUNT(*) as cnt FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?) AND (guildId IS NULL OR guildId != ?)', [userId, now, user?.guildId || 0])).cnt;
    if (count === 0)
        return res.status(404).json({ error: 'Нет доступных соперников' });
    res.json({ available: true });
});
exports.default = router;
//# sourceMappingURL=arena.js.map