import { Router } from 'express';
import { db } from '../db/index';
import { BUILDINGS, getBuildingCost, getBuildingReqLevel } from '../game/guildBuildings';
import type { BuildingType } from '../game/guildBuildings';

const router = Router();

// Авто-создание таблицы
db.run(`CREATE TABLE IF NOT EXISTS guild_buildings (
    id SERIAL PRIMARY KEY,
    guildId INTEGER NOT NULL,
    buildingType TEXT NOT NULL,
    level INTEGER DEFAULT 0,
    UNIQUE(guildId, buildingType)
)`).catch(() => {});

// Получить сооружения гильдии
router.get('/guild/:guildId/buildings', async (req, res) => {
    const guildId = parseInt(req.params.guildId);
    if (!guildId) return res.status(400).json({ error: 'guildId required' });

    const guild = await db.one('SELECT level, treasury FROM guilds WHERE id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });

    const rows = await db.query('SELECT * FROM guild_buildings WHERE guildId = ?', [guildId]) as any[];
    const buildings: Record<string, number> = {};
    for (const r of rows) buildings[r.buildingtype] = r.level;

    const result: any[] = [];
    for (const [key, cfg] of Object.entries(BUILDINGS)) {
        const level = buildings[key] || 0;
        const nextLevel = level + 1;
        const cost = getBuildingCost(nextLevel);
        const reqLevel = getBuildingReqLevel(nextLevel);
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
            canUpgrade: guild.level >= reqLevel && guild.treasury >= cost,
        });
    }
    res.json(result);
});

// Улучшить сооружение
router.post('/guild/:guildId/buildings/upgrade', async (req, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.guildId);
    const buildingType = req.body.buildingType as BuildingType;

    if (!guildId || !buildingType) return res.status(400).json({ error: 'guildId и buildingType обязательны' });
    if (!BUILDINGS[buildingType]) return res.status(400).json({ error: 'Неизвестный тип сооружения' });

    // Проверяем права (лидер или офицер с правом на постройки)
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ? AND guildId = ?', [userId, guildId]) as any;
    if (!member || (member.rank !== 'leader' && !(member.rank === 'officer' && member.can_buildings))) {
        return res.status(403).json({ error: 'Только лидер или офицер с правом на постройки может улучшать сооружения' });
    }

    // Получаем гильдию
    const guild = await db.one('SELECT * FROM guilds WHERE id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });

    // Текущий уровень
    const row = await db.one('SELECT * FROM guild_buildings WHERE guildId = ? AND buildingType = ?', [guildId, buildingType]) as any;
    const currentLevel = row?.level || 0;
    const nextLevel = currentLevel + 1;

    // Требования
    const cost = getBuildingCost(nextLevel);
    const reqLevel = getBuildingReqLevel(nextLevel);

    if (guild.level < reqLevel) {
        return res.status(400).json({ error: `Требуется ${reqLevel} уровень гильдии (сейчас ${guild.level})` });
    }
    if (guild.treasury < cost) {
        return res.status(400).json({ error: `Недостаточно серебра в казне. Нужно ${cost.toLocaleString()}, есть ${(guild.treasury || 0).toLocaleString()}` });
    }

    // Списываем из казны
    await db.run('UPDATE guilds SET treasury = treasury - ? WHERE id = ?', [cost, guildId]);

    // Апгрейд
    if (row) {
        await db.run('UPDATE guild_buildings SET level = ? WHERE guildId = ? AND buildingType = ?', [nextLevel, guildId, buildingType]);
    } else {
        await db.run('INSERT INTO guild_buildings (guildId, buildingType, level) VALUES (?, ?, ?)', [guildId, buildingType, nextLevel]);
    }

    res.json({ success: true, level: nextLevel, cost, treasury: guild.treasury - cost });
});

export default router;
