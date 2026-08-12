"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const helpers_1 = require("../db/helpers");
const drinks_1 = require("../game/drinks");
const guildBuildings_1 = require("../game/guildBuildings");
const stats_1 = require("../game/stats");
const router = (0, express_1.Router)();
const CTX_LABELS = {
    arena: 'PvP / Арена',
    tournament: 'Турнир',
    pve: 'PvE (мобы)',
    war_attack: 'Война гильдий — атака',
    war_defense: 'Война гильдий — защита',
};
const DRINK_NAMES = {
    rage_small: 'Настойка ярости', rage_med: 'Крепкая настойка ярости', rage_big: 'Эликсир берсерка',
    shadow_small: 'Настойка теней', shadow_med: 'Крепкая настойка теней', shadow_big: 'Эликсир призрака',
    stone_small: 'Настойка камня', stone_med: 'Крепкая настойка камня', stone_big: 'Эликсир бастиона',
    eye_small: 'Настойка ока', eye_med: 'Крепкая настойка ока', eye_big: 'Эликсир пророка',
    grog_small: 'Грог Моры', grog_med: 'Крепкий грог', dragon_blood: 'Кровь дракона',
};
router.post('/debug/stats', async (req, res) => {
    const { username, context, drink } = req.body;
    if (!username)
        return res.status(400).json({ error: 'Укажите username' });
    if (!context || !CTX_LABELS[context]) {
        return res.status(400).json({ error: 'Укажите корректный context: arena, tournament, pve, war_attack, war_defense' });
    }
    const user = await index_1.db.one('SELECT u.*, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.username = ?', [username]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    // Raw stats (base + equipment, no bonuses)
    const base = (0, helpers_1.getBaseStats)(user);
    const rawEquip = JSON.parse(user.equipment || '{}');
    const { enriched } = await (0, helpers_1.enrichEquipment)(rawEquip);
    const rawStats = (0, stats_1.currentStats)(base, enriched);
    // Bonuses — если указан напиток, используем его вместо активного у персонажа
    const drinkBonuses = drink && drinks_1.DRINK_BONUSES[drink]
        ? drinks_1.DRINK_BONUSES[drink]
        : (0, drinks_1.getDrinkBonuses)(user);
    const selectedDrink = drink && drinks_1.DRINK_BONUSES[drink] ? drink : (user.activeDrink || null);
    const collectionBonus = await (0, helpers_1.getCollectionBonus)(user.id);
    const guildBonus = await (0, guildBuildings_1.getGuildBonus)(user.id, context);
    // Full stats with all bonuses
    const fullStats = (0, stats_1.currentStats)(base, enriched, drinkBonuses, collectionBonus, guildBonus);
    // Guild buildings
    const buildings = [];
    if (user.guildId) {
        const rows = await index_1.db.query('SELECT buildingType, level FROM guild_buildings WHERE guildId = ?', [user.guildId]);
        for (const row of rows) {
            const cfg = guildBuildings_1.BUILDINGS[row.buildingtype];
            if (cfg) {
                buildings.push({
                    type: row.buildingtype,
                    name: cfg.name,
                    level: row.level || 0,
                    bonus: (row.level || 0) * cfg.bonusPerLevel,
                    appliesTo: cfg.appliesTo,
                });
            }
        }
    }
    const statNames = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };
    // Список всех напитков
    const availableDrinks = Object.entries(drinks_1.DRINK_BONUSES).map(([key, bonuses]) => ({
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
exports.default = router;
//# sourceMappingURL=debug.js.map