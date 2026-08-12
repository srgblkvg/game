"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const guildBuildings_1 = require("../game/guildBuildings");
const router = (0, express_1.Router)();
// Авто-создание таблицы
index_1.db.run(`CREATE TABLE IF NOT EXISTS guild_buildings (
    id SERIAL PRIMARY KEY,
    guildId INTEGER NOT NULL,
    buildingType TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    UNIQUE(guildId, buildingType)
)`).catch(() => { });
// Получить сооружения гильдии
router.get('/guild/:guildId/buildings', async (req, res) => {
    const guildId = parseInt(req.params.guildId);
    if (!guildId)
        return res.status(400).json({ error: 'guildId required' });
    const guild = await index_1.db.one('SELECT level, treasury FROM guilds WHERE id = ?', [guildId]);
    if (!guild)
        return res.status(404).json({ error: 'Гильдия не найдена' });
    const rows = await index_1.db.query('SELECT * FROM guild_buildings WHERE guildId = ?', [guildId]);
    const buildings = {};
    for (const r of rows)
        buildings[r.buildingtype] = r.level;
    const result = [];
    for (const [key, cfg] of Object.entries(guildBuildings_1.BUILDINGS)) {
        const level = buildings[key] || 0;
        const nextLevel = level + 1;
        const cost = (0, guildBuildings_1.getBuildingCost)(nextLevel);
        const reqLevel = (0, guildBuildings_1.getBuildingReqLevel)(nextLevel);
        result.push({
            type: key,
            name: cfg.name,
            icon: cfg.icon,
            desc: cfg.desc,
            bonus: level * cfg.bonusPerLevel,
            level,
            nextCost: cost,
            nextBonus: nextLevel * cfg.bonusPerLevel,
            reqLevel,
            canBuild: guild.level >= reqLevel && guild.treasury >= cost,
        });
    }
    res.json(result);
});
// Улучшить сооружение
router.post('/guild/:guildId/buildings/upgrade', async (req, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.guildId);
    const buildingType = req.body.buildingType;
    if (!guildId || !buildingType)
        return res.status(400).json({ error: 'guildId и buildingType обязательны' });
    if (!guildBuildings_1.BUILDINGS[buildingType])
        return res.status(400).json({ error: 'Неизвестный тип сооружения' });
    // Проверяем права (лидер или офицер с правом на постройки)
    const member = await index_1.db.one('SELECT * FROM guild_members WHERE userId = ? AND guildId = ?', [userId, guildId]);
    if (!member || (member.rank !== 'leader' && !(member.rank === 'officer' && member.can_buildings))) {
        return res.status(403).json({ error: 'Только лидер или офицер с правом на постройки может улучшать сооружения' });
    }
    // Получаем гильдию
    const guild = await index_1.db.one('SELECT * FROM guilds WHERE id = ?', [guildId]);
    if (!guild)
        return res.status(404).json({ error: 'Гильдия не найдена' });
    // Текущий уровень
    const row = await index_1.db.one('SELECT * FROM guild_buildings WHERE guildId = ? AND buildingType = ?', [guildId, buildingType]);
    const currentLevel = row?.level || 0;
    const nextLevel = currentLevel + 1;
    // Требования
    const cost = (0, guildBuildings_1.getBuildingCost)(nextLevel);
    const reqLevel = (0, guildBuildings_1.getBuildingReqLevel)(nextLevel);
    if (guild.level < reqLevel) {
        return res.status(400).json({ error: `Требуется ${reqLevel} уровень гильдии (сейчас ${guild.level})` });
    }
    if (guild.treasury < cost) {
        return res.status(400).json({ error: `Недостаточно серебра в казне. Нужно ${cost.toLocaleString()}, есть ${(guild.treasury || 0).toLocaleString()}` });
    }
    // Списываем из казны
    await index_1.db.run('UPDATE guilds SET treasury = treasury - ? WHERE id = ?', [cost, guildId]);
    // Апгрейд
    if (row) {
        await index_1.db.run('UPDATE guild_buildings SET level = ? WHERE guildId = ? AND buildingType = ?', [nextLevel, guildId, buildingType]);
    }
    else {
        await index_1.db.run('INSERT INTO guild_buildings (guildId, buildingType, level) VALUES (?, ?, ?)', [guildId, buildingType, nextLevel]);
    }
    res.json({ success: true, level: nextLevel, cost, treasury: guild.treasury - cost });
});
exports.default = router;
//# sourceMappingURL=guildBuildings.js.map