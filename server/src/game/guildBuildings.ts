import { db } from '../db/index';

const BUILDINGS = {
    training_ground: {
        name: 'Тренировочная площадка',
        icon: '🏟️',
        desc: 'Характеристики на арене и турнирах',
        bonusPerLevel: 5,
        appliesTo: ['arena', 'tournament'] as const,
    },
    scout_hq: {
        name: 'Штаб разведки',
        icon: '🔭',
        desc: 'Характеристики против монстров',
        bonusPerLevel: 5,
        appliesTo: ['pve'] as const,
    },
    siege_camp: {
        name: 'Осадный лагерь',
        icon: '⚔️',
        desc: 'Характеристики при атаке в войне гильдий',
        bonusPerLevel: 5,
        appliesTo: ['war_attack'] as const,
    },
    walls: {
        name: 'Стены',
        icon: '🏰',
        desc: 'Характеристики при защите в войне гильдий',
        bonusPerLevel: 5,
        appliesTo: ['war_defense'] as const,
    },
} as const;

type Context = 'arena' | 'tournament' | 'pve' | 'war_attack' | 'war_defense';
export type BuildingType = keyof typeof BUILDINGS;

export function getBuildingCost(level: number): number {
    return 100000 * Math.pow(2, level - 1);
}

export function getBuildingReqLevel(level: number): number {
    return level;
}

/** Получить бонус гильдейских сооружений для пользователя в данном контексте */
export async function getGuildBonus(userId: number, context: Context): Promise<number> {
    const user = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (!user?.guildid) return 0;

    const rows = await db.query(
        'SELECT buildingType, level FROM guild_buildings WHERE guildId = ?',
        [user.guildid]
    ) as any[];

    let totalBonus = 0;
    for (const row of rows) {
        const cfg = BUILDINGS[row.buildingtype as BuildingType];
        if (!cfg) continue;
        if ((cfg.appliesTo as unknown as readonly string[]).includes(context)) {
            totalBonus += (row.level || 0) * cfg.bonusPerLevel;
        }
    }

    return totalBonus;
}

export { BUILDINGS };

/** Получить ВСЕ сооружения (построенные + доступные для постройки) */
export async function getGuildBuildings(userId: number) {
    const user = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (!user?.guildid) return [];

    const guild = await db.one('SELECT level, treasury FROM guilds WHERE id = ?', [user.guildid]) as any;
    const rows = await db.query('SELECT buildingType, level FROM guild_buildings WHERE guildId = ?', [user.guildid]) as any[];
    const built: Record<string,number> = {};
    for (const r of rows) built[r.buildingtype] = r.level;

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
export async function buildBuilding(userId: number, buildingType: BuildingType) {
    const user = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (!user?.guildid) throw new Error('Не в гильдии');
    const member = await db.one('SELECT rank FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;
    if (!member || member.rank !== 'leader') throw new Error('Только лидер');

    const guild = await db.one('SELECT level, treasury FROM guilds WHERE id = ?', [user.guildid]) as any;
    const row = await db.one('SELECT level FROM guild_buildings WHERE guildId = ? AND buildingType = ?', [user.guildid, buildingType]).catch(() => null);
    const currentLevel = row?.level || 0;
    const nextLevel = currentLevel + 1;
    const cost = getBuildingCost(nextLevel);
    const reqLevel = getBuildingReqLevel(nextLevel);

    if (guild.level < reqLevel) throw new Error(`Нужен уровень гильдии ${reqLevel}`);
    if (guild.treasury < cost) throw new Error(`Нужно ${cost.toLocaleString()} серебра в казне`);

    await db.run('UPDATE guilds SET treasury = treasury - ? WHERE id = ?', [cost, user.guildid]);
    if (currentLevel === 0) {
        await db.run('INSERT INTO guild_buildings (guildId, buildingType, level) VALUES (?, ?, 1)', [user.guildid, buildingType]);
    } else {
        await db.run('UPDATE guild_buildings SET level = level + 1 WHERE guildId = ? AND buildingType = ?', [user.guildid, buildingType]);
    }
    return { success: true, buildingType, level: nextLevel, cost };
}
