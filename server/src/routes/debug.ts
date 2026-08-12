import { Router } from 'express';
import { db } from '../db/index';
import { getBaseStats, enrichEquipment, getCollectionBonus } from '../db/helpers';
import { getDrinkBonuses, DRINK_BONUSES } from '../game/drinks';
import { getGuildBonus, BUILDINGS } from '../game/guildBuildings';
import { currentStats, type CharStats, type StatRecord } from '../game/stats';

const router = Router();

type Context = 'arena' | 'tournament' | 'pve' | 'war_attack' | 'war_defense';

const CTX_LABELS: Record<Context, string> = {
    arena: 'PvP / Арена',
    tournament: 'Турнир',
    pve: 'PvE (мобы)',
    war_attack: 'Война гильдий — атака',
    war_defense: 'Война гильдий — защита',
};

const DRINK_NAMES: Record<string, string> = {
    rage_small: 'Настойка ярости', rage_med: 'Крепкая настойка ярости', rage_big: 'Эликсир берсерка',
    shadow_small: 'Настойка теней', shadow_med: 'Крепкая настойка теней', shadow_big: 'Эликсир призрака',
    stone_small: 'Настойка камня', stone_med: 'Крепкая настойка камня', stone_big: 'Эликсир бастиона',
    eye_small: 'Настойка ока', eye_med: 'Крепкая настойка ока', eye_big: 'Эликсир пророка',
    grog_small: 'Грог Моры', grog_med: 'Крепкий грог', dragon_blood: 'Кровь дракона',
};

router.post('/debug/stats', async (req, res) => {
    const { username, context, drink } = req.body as { username?: string; context?: Context; drink?: string };
    if (!username) return res.status(400).json({ error: 'Укажите username' });
    if (!context || !CTX_LABELS[context]) {
        return res.status(400).json({ error: 'Укажите корректный context: arena, tournament, pve, war_attack, war_defense' });
    }

    const user = await db.one(
        'SELECT u.*, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.username = ?',
        [username]
    ) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    // Raw stats (base + equipment, no bonuses)
    const base = getBaseStats(user);
    const rawEquip = JSON.parse(user.equipment || '{}');
    const { enriched } = await enrichEquipment(rawEquip);
    const rawStats = currentStats(base, enriched);

    // Bonuses — если указан напиток, используем его вместо активного у персонажа
    const drinkBonuses: StatRecord = drink && DRINK_BONUSES[drink]
        ? DRINK_BONUSES[drink]
        : getDrinkBonuses(user);
    const selectedDrink = drink && DRINK_BONUSES[drink] ? drink : (user.activeDrink || null);
    const collectionBonus = await getCollectionBonus(user.id);
    const guildBonus = await getGuildBonus(user.id, context);

    // Full stats with all bonuses
    const fullStats = currentStats(base, enriched, drinkBonuses, collectionBonus, guildBonus);

    // Guild buildings
    const buildings: { type: string; name: string; level: number; bonus: number; appliesTo: readonly string[] }[] = [];
    if (user.guildId) {
        const rows = await db.query(
            'SELECT buildingType, level FROM guild_buildings WHERE guildId = ?',
            [user.guildId]
        ) as any[];
        for (const row of rows) {
            const cfg = BUILDINGS[row.buildingtype as keyof typeof BUILDINGS];
            if (cfg) {
                buildings.push({
                    type: row.buildingtype,
                    name: cfg.name,
                    level: row.level || 0,
                    bonus: (row.level || 0) * cfg.bonusPerLevel,
                    appliesTo: cfg.appliesTo as unknown as readonly string[],
                });
            }
        }
    }

    const statNames: Record<string, string> = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };

    // Список всех напитков
    const availableDrinks = Object.entries(DRINK_BONUSES).map(([key, bonuses]) => ({
        key,
        name: DRINK_NAMES[key] || key,
        bonuses,
    }));

    res.json({
        username: user.username,
        level: user.level,
        guildName: user.guildName || null,
        context,
        contextLabel: CTX_LABELS[context],
        selectedDrink,
        activeDrink: user.activeDrink || null,
        raw: {
            base: statNames.s ? { s: base.s, a: base.a, d: base.d, m: base.m } : base,
            equipment: { s: rawStats.bonuses.s, a: rawStats.bonuses.a, d: rawStats.bonuses.d, m: rawStats.bonuses.m },
            hp: rawStats.hp,
            extra: rawStats.extra,
        },
        bonuses: {
            drinks: drinkBonuses,
            collection: collectionBonus,
            guild: guildBonus,
        },
        full: {
            stats: { s: fullStats.s, a: fullStats.a, d: fullStats.d, m: fullStats.m },
            hp: fullStats.hp,
            extra: fullStats.extra,
        },
        buildings,
        availableDrinks,
        statNames,
    });
});

export default router;
