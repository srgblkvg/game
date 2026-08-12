"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILDINGS = void 0;
exports.getBuildingCost = getBuildingCost;
exports.getBuildingReqLevel = getBuildingReqLevel;
exports.getGuildBonus = getGuildBonus;
exports.getGuildBuildings = getGuildBuildings;
exports.buildBuilding = buildBuilding;
const index_1 = require("../db/index");
const BUILDINGS = {
    training_ground: {
        name: 'Тренировочная площадка',
        icon: '🏟️',
        desc: 'Характеристики на арене и турнирах',
        bonusPerLevel: 5,
        appliesTo: ['arena', 'tournament'],
    },
    scout_hq: {
        name: 'Штаб разведки',
        icon: '🔭',
        desc: 'Характеристики против монстров',
        bonusPerLevel: 5,
        appliesTo: ['pve'],
    },
    siege_camp: {
        name: 'Осадный лагерь',
        icon: '⚔️',
        desc: 'Характеристики при атаке в войне гильдий',
        bonusPerLevel: 5,
        appliesTo: ['war_attack'],
    },
    walls: {
        name: 'Стены',
        icon: '🏰',
        desc: 'Характеристики при защите в войне гильдий',
        bonusPerLevel: 5,
        appliesTo: ['war_defense'],
    },
};
exports.BUILDINGS = BUILDINGS;
function getBuildingCost(level) {
    return 100000 * Math.pow(2, level - 1);
}
function getBuildingReqLevel(level) {
    return level;
}
/** Получить бонус гильдейских сооружений для пользователя в данном контексте */
async function getGuildBonus(userId, context) {
    const user = await index_1.db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
    if (!user?.guildid)
        return 0;
    const rows = await index_1.db.query('SELECT buildingType, level FROM guild_buildings WHERE guildId = ?', [user.guildid]);
    let totalBonus = 0;
    for (const row of rows) {
        const cfg = BUILDINGS[row.buildingtype];
        if (!cfg)
            continue;
        if (cfg.appliesTo.includes(context)) {
            totalBonus += (row.level || 0) * cfg.bonusPerLevel;
        }
    }
    return totalBonus;
}
/** Получить ВСЕ сооружения (построенные + доступные для постройки) */
async function getGuildBuildings(userId) {
    const user = await index_1.db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
    if (!user?.guildid)
        return [];
    const guild = await index_1.db.one('SELECT level, treasury FROM guilds WHERE id = ?', [user.guildid]);
    const rows = await index_1.db.query('SELECT buildingType, level FROM guild_buildings WHERE guildId = ?', [user.guildid]);
    const built = {};
    for (const r of rows)
        built[r.buildingtype] = r.level;
    return Object.entries(BUILDINGS).map(([type, cfg]) => {
        const level = built[type] || 0;
        const nextLevel = level + 1;
        const cost = getBuildingCost(nextLevel);
        const reqLevel = getBuildingReqLevel(nextLevel);
        return {
            type,
            icon: cfg.icon,
            label: cfg.name,
            desc: cfg.desc,
            level,
            bonus: level * cfg.bonusPerLevel,
            nextBonus: cfg.bonusPerLevel,
            cost,
            reqLevel,
            canBuild: guild.level >= reqLevel && guild.treasury >= cost,
        };
    });
}
/** Построить/улучшить сооружение */
async function buildBuilding(userId, buildingType) {
    const user = await index_1.db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
    if (!user?.guildid)
        throw new Error('Не в гильдии');
    const member = await index_1.db.one('SELECT rank, can_buildings FROM guild_members WHERE userid = ? AND guildid = ?', [userId, user.guildid]);
    if (!member)
        throw new Error('Не в гильдии');
    if (member.rank !== 'leader' && !(member.rank === 'officer' && member.can_buildings)) {
        throw new Error('Только лидер или офицер с правом на постройки');
    }
    const guild = await index_1.db.one('SELECT level, treasury FROM guilds WHERE id = ?', [user.guildid]);
    const row = await index_1.db.one('SELECT level FROM guild_buildings WHERE guildId = ? AND buildingType = ?', [user.guildid, buildingType]).catch(() => null);
    const currentLevel = row?.level || 0;
    const nextLevel = currentLevel + 1;
    const cost = getBuildingCost(nextLevel);
    const reqLevel = getBuildingReqLevel(nextLevel);
    if (guild.level < reqLevel)
        throw new Error(`Нужен уровень гильдии ${reqLevel}`);
    if (guild.treasury < cost)
        throw new Error(`Нужно ${cost.toLocaleString()} серебра в казне`);
    await index_1.db.run('UPDATE guilds SET treasury = treasury - ? WHERE id = ?', [cost, user.guildid]);
    if (currentLevel === 0) {
        await index_1.db.run('INSERT INTO guild_buildings (guildId, buildingType, level) VALUES (?, ?, 1)', [user.guildid, buildingType]);
    }
    else {
        await index_1.db.run('UPDATE guild_buildings SET level = level + 1 WHERE guildId = ? AND buildingType = ?', [user.guildid, buildingType]);
    }
    return { success: true, buildingType, level: nextLevel, cost };
}
//# sourceMappingURL=guildBuildings.js.map