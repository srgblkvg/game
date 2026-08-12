"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deliverStarterPack = deliverStarterPack;
exports.deliverSilver = deliverSilver;
exports.deliverCraftPack = deliverCraftPack;
exports.deliverCursePack = deliverCursePack;
exports.deliverRubyRune = deliverRubyRune;
exports.deliverMegaCraftSet = deliverMegaCraftSet;
exports.deliverLargeCraftSet = deliverLargeCraftSet;
exports.deliverRuneStonePack = deliverRuneStonePack;
exports.deliverCraftRare200 = deliverCraftRare200;
const express_1 = require("express");
const index_1 = require("../db/index");
const auth_1 = require("../middleware/auth");
const events_1 = require("../events");
const logger_1 = __importDefault(require("../logger"));
const router = (0, express_1.Router)();
// DDL: флаг покупки стартового набора
index_1.db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS starter_pack_purchased BOOLEAN DEFAULT false`).catch(() => { });
// Все слоты экипировки
const ALL_SLOTS = ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt'];
// Выдать стартовый набор игроку (вызывается из payment-колбэков)
async function deliverStarterPack(userId) {
    try {
        const user = await index_1.db.one('SELECT id, starter_pack_purchased, premiumUntil, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        if (user.starter_pack_purchased)
            return { success: false, error: 'Стартовый набор уже получен' };
        const now = Math.floor(Date.now() / 1000);
        // 1. Собираем фулл сет необычных предметов (rarity_id=2, по одному на слот)
        const packItems = [];
        for (const slot of ALL_SLOTS) {
            const item = await index_1.db.one('SELECT id, name, slot, rarity_id, bonuses, extra, image FROM items WHERE rarity_id = 2 AND slot = ? ORDER BY id LIMIT 1', [slot]);
            if (item) {
                packItems.push({
                    id: Date.now() + Math.random(),
                    name: item.name,
                    slot: item.slot,
                    rarity_id: item.rarity_id,
                    bonuses: JSON.parse(item.bonuses || '{}'),
                    extra: JSON.parse(item.extra || '{}'),
                    image: item.image || null,
                });
            }
        }
        // 2. 4 шт Эссенции мрака (craft_item, rarity_id=3)
        const fragmentItem = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = 'Эссенция мрака'");
        // 3. Добавляем всё в инвентарь
        const inventory = JSON.parse(user.inventory || '[]');
        for (const item of packItems)
            inventory.push(item);
        // Эссенция мрака — стакается с существующими
        if (fragmentItem) {
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === fragmentItem.id);
            if (existing) {
                existing.count = (existing.count || 0) + 4;
            }
            else {
                inventory.push({
                    type: 'craft_item',
                    id: fragmentItem.id,
                    name: fragmentItem.name,
                    rarity_id: fragmentItem.rarity_id,
                    rarity_display: fragmentItem.rarity_display,
                    rarity_color: fragmentItem.rarity_color,
                    count: 4,
                    itemType: fragmentItem.type || 'craft',
                    image: fragmentItem.image || null,
                });
            }
        }
        // 4. Считаем премиум и серебро (в банк)
        const currentPremium = Math.max(user.premiumUntil || 0, now);
        const newPremiumUntil = currentPremium + 7 * 86400; // 7 дней
        const newBank = (user.bank || 0) + 10000;
        // 5. Атомарное обновление
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ?, premiumUntil = ?, starter_pack_purchased = true WHERE id = ?', [JSON.stringify(inventory), newBank, newPremiumUntil, userId]);
        // Уведомление
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate', until: newPremiumUntil });
        logger_1.default.info(`[Donate] Starter pack delivered to user ${userId}: ${packItems.length} items + 4 essences + 10000 silver to bank + 7d premium`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverStarterPack error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать серебро игроку в банк (вызывается из payment-колбэков)
async function deliverSilver(userId, amount) {
    try {
        const user = await index_1.db.one('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        await index_1.db.run('UPDATE users SET bank = bank + ? WHERE id = ?', [amount, userId]);
        // Уведомление
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] ${amount} silver delivered to bank of user ${userId}`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverSilver error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать сундук с материалами (craft_pack)
async function deliverCraftPack(userId, packType) {
    try {
        const user = await index_1.db.one('SELECT id, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const packs = {
            rare: { material: 'Сердцевина бездны', matCount: 5, stone: 'Рунный булыжник', stoneCount: 6, silver: 10000 },
            epic: { material: 'Искра погибели', matCount: 5, stone: 'Рунный булыжник', stoneCount: 10, silver: 30000 },
        };
        const pack = packs[packType];
        if (!pack)
            return { success: false, error: 'Неизвестный набор' };
        // Получаем данные из БД
        const matItem = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [pack.material]);
        const stoneItem = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [pack.stone]);
        const inventory = JSON.parse(user.inventory || '[]');
        // Хелпер: добавить/стакнуть craft_item
        const addStack = (item, qty) => {
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === item.id);
            if (existing) {
                existing.count = (existing.count || 0) + qty;
            }
            else {
                inventory.push({
                    type: 'craft_item',
                    id: item.id,
                    name: item.name,
                    rarity_id: item.rarity_id,
                    rarity_display: item.rarity_display,
                    rarity_color: item.rarity_color,
                    count: qty,
                    itemType: item.type || 'craft',
                    image: item.image || null,
                });
            }
        };
        if (matItem)
            addStack(matItem, pack.matCount);
        if (stoneItem)
            addStack(stoneItem, pack.stoneCount);
        const newBank = (user.bank || 0) + pack.silver;
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ? WHERE id = ?', [JSON.stringify(inventory), newBank, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Craft pack ${packType} delivered to user ${userId}`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverCraftPack error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// GET /api/donate/starter-pack/status — проверить, куплен ли стартовый набор
router.get('/starter-pack/status', auth_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const user = await index_1.db.one('SELECT starter_pack_purchased FROM users WHERE id = ?', [userId]);
        res.json({ purchased: user?.starter_pack_purchased || false });
    }
    catch {
        res.json({ purchased: false });
    }
});
// GET /api/donate/starter-pack/preview — состав набора (для страницы)
router.get('/starter-pack/preview', auth_1.authMiddleware, async (_req, res) => {
    try {
        // Необычные предметы по одному на слот
        const equipment = [];
        for (const slot of ALL_SLOTS) {
            const item = await index_1.db.one(`SELECT i.id, i.name, i.slot, i.rarity_id, i.bonuses, i.extra, i.image,
                r.display_name as rarity_display, r.color as rarity_color
         FROM items i JOIN rarities r ON i.rarity_id = r.id
         WHERE i.rarity_id = 2 AND i.slot = ? ORDER BY i.id LIMIT 1`, [slot]);
            if (item) {
                equipment.push({
                    name: item.name,
                    slot: item.slot,
                    rarity_id: item.rarity_id,
                    rarity_display: item.rarity_display,
                    rarity_color: item.rarity_color,
                    bonuses: JSON.parse(item.bonuses || '{}'),
                    extra: JSON.parse(item.extra || '{}'),
                    image: item.image || null,
                });
            }
        }
        // Эссенция мрака
        const fragment = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = 'Эссенция мрака'");
        res.json({
            equipment,
            fragment: fragment ? {
                name: fragment.name,
                rarity_id: fragment.rarity_id,
                rarity_display: fragment.rarity_display,
                rarity_color: fragment.rarity_color,
                type: fragment.type,
                image: fragment.image || null,
                count: 4,
            } : null,
        });
    }
    catch (err) {
        logger_1.default.error(`[Donate] starter-pack/preview error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
// Выдать сундук с кристаллами душ (curse_pack)
async function deliverCursePack(userId, packType) {
    try {
        const user = await index_1.db.one('SELECT id, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const packs = {
            small: { silver: 500000, crystals: 5 },
            large: { silver: 1000000, crystals: 10 },
            x50: { silver: 5000000, crystals: 50 },
            x100: { silver: 10000000, crystals: 100 },
        };
        const pack = packs[packType];
        if (!pack)
            return { success: false, error: 'Неизвестный набор' };
        // Получаем Кристалл душ из БД
        const crystalItem = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = 'Кристалл душ'");
        const inventory = JSON.parse(user.inventory || '[]');
        if (crystalItem) {
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === crystalItem.id);
            if (existing) {
                existing.count = (existing.count || 0) + pack.crystals;
            }
            else {
                inventory.push({
                    type: 'craft_item',
                    id: crystalItem.id,
                    name: crystalItem.name,
                    rarity_id: crystalItem.rarity_id,
                    rarity_display: crystalItem.rarity_display,
                    rarity_color: crystalItem.rarity_color,
                    count: pack.crystals,
                    itemType: crystalItem.type || 'soul_crystal',
                    image: crystalItem.image || null,
                });
            }
        }
        const newBank = (user.bank || 0) + pack.silver;
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ? WHERE id = ?', [JSON.stringify(inventory), newBank, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Curse pack ${packType} delivered to user ${userId}: ${pack.crystals} crystals + ${pack.silver} silver to bank`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverCursePack error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать набор рун (Рубина + Топаз + Аметист)
async function deliverRubyRune(userId, count) {
    try {
        const user = await index_1.db.one('SELECT id, inventory FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const runeNames = ['Руна Рубина', 'Руна Топаза', 'Руна Аметиста'];
        const runeItems = [];
        for (const name of runeNames) {
            const item = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [name]);
            if (item)
                runeItems.push(item);
        }
        if (runeItems.length === 0)
            return { success: false, error: 'Руны не найдены в БД' };
        const inventory = JSON.parse(user.inventory || '[]');
        for (const runeItem of runeItems) {
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === runeItem.id);
            if (existing) {
                existing.count = (existing.count || 0) + count;
            }
            else {
                inventory.push({
                    type: 'craft_item',
                    id: runeItem.id,
                    name: runeItem.name,
                    rarity_id: runeItem.rarity_id,
                    rarity_display: runeItem.rarity_display,
                    rarity_color: runeItem.rarity_color,
                    count,
                    itemType: runeItem.type || 'upgrade',
                    image: runeItem.image || null,
                });
            }
        }
        await index_1.db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Rune pack ×${count} (Ruby+Topaz+Amethyst) delivered to user ${userId}`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverRubyRune error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать Мега набор ремесленника (7 рун ×200 + 7 материалов ×200 + 20M серебра в банк)
async function deliverMegaCraftSet(userId) {
    try {
        const user = await index_1.db.one('SELECT id, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const runeNames = ['Руна Рубина', 'Руна Топаза', 'Руна Аметиста', 'Руна Сапфира', 'Руна Изумруда', 'Рунный булыжник', 'Рунный белокамень'];
        const materialNames = ['Пыль забвения', 'Осколок скорби', 'Фрагмент ужаса', 'Эссенция мрака', 'Сердцевина бездны', 'Искра погибели', 'Слеза вечности'];
        const allNames = [...runeNames, ...materialNames];
        const inventory = JSON.parse(user.inventory || '[]');
        let deliveredCount = 0;
        for (const name of allNames) {
            const item = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [name]);
            if (!item) {
                logger_1.default.warn(`[Donate] mega_craft: item not found: ${name}`);
                continue;
            }
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === item.id);
            if (existing) {
                existing.count = (existing.count || 0) + 200;
            }
            else {
                inventory.push({
                    type: 'craft_item',
                    id: item.id,
                    name: item.name,
                    rarity_id: item.rarity_id,
                    rarity_display: item.rarity_display,
                    rarity_color: item.rarity_color,
                    count: 200,
                    itemType: item.type || 'upgrade',
                    image: item.image || null,
                });
            }
            deliveredCount++;
        }
        const newBank = (user.bank || 0) + 20000000;
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ? WHERE id = ?', [JSON.stringify(inventory), newBank, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Mega craft set delivered to user ${userId}: ${deliveredCount} item types ×200 + 20M silver to bank`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverMegaCraftSet error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать Большой набор ремесленника (7 рун ×100 + 7 материалов ×100 + 10M серебра в банк)
async function deliverLargeCraftSet(userId) {
    try {
        const user = await index_1.db.one('SELECT id, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const runeNames = ['Руна Рубина', 'Руна Топаза', 'Руна Аметиста', 'Руна Сапфира', 'Руна Изумруда', 'Рунный булыжник', 'Рунный белокамень'];
        const materialNames = ['Пыль забвения', 'Осколок скорби', 'Фрагмент ужаса', 'Эссенция мрака', 'Сердцевина бездны', 'Искра погибели', 'Слеза вечности'];
        const allNames = [...runeNames, ...materialNames];
        const inventory = JSON.parse(user.inventory || '[]');
        let deliveredCount = 0;
        for (const name of allNames) {
            const item = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [name]);
            if (!item) {
                logger_1.default.warn(`[Donate] large_craft: item not found: ${name}`);
                continue;
            }
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === item.id);
            if (existing) {
                existing.count = (existing.count || 0) + 100;
            }
            else {
                inventory.push({
                    type: 'craft_item',
                    id: item.id,
                    name: item.name,
                    rarity_id: item.rarity_id,
                    rarity_display: item.rarity_display,
                    rarity_color: item.rarity_color,
                    count: 100,
                    itemType: item.type || 'upgrade',
                    image: item.image || null,
                });
            }
            deliveredCount++;
        }
        const newBank = (user.bank || 0) + 10000000;
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ? WHERE id = ?', [JSON.stringify(inventory), newBank, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Large craft set delivered to user ${userId}: ${deliveredCount} item types ×100 + 10M silver to bank`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverLargeCraftSet error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать Набор рунного булыжника (200 булыжников + 200 сердцевин + 20M серебра в банк)
async function deliverRuneStonePack(userId) {
    try {
        const user = await index_1.db.one('SELECT id, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const names = ['Рунный булыжник', 'Сердцевина бездны'];
        const inventory = JSON.parse(user.inventory || '[]');
        for (const name of names) {
            const item = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [name]);
            if (!item) {
                logger_1.default.warn(`[Donate] rune_stone: item not found: ${name}`);
                continue;
            }
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === item.id);
            if (existing) {
                existing.count = (existing.count || 0) + 200;
            }
            else {
                inventory.push({
                    type: 'craft_item', id: item.id, name: item.name,
                    rarity_id: item.rarity_id, rarity_display: item.rarity_display, rarity_color: item.rarity_color,
                    count: 200, itemType: item.type || 'upgrade', image: item.image || null,
                });
            }
        }
        const newBank = (user.bank || 0) + 20000000;
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ? WHERE id = ?', [JSON.stringify(inventory), newBank, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Rune stone pack delivered to user ${userId}: 200 rune stones + 200 cores + 20M silver to bank`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverRuneStonePack error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
// Выдать Рунный набор ×200 (1000 сердцевин + 1200 булыжников + 2M серебра в банк)
async function deliverCraftRare200(userId) {
    try {
        const user = await index_1.db.one('SELECT id, inventory, bank FROM users WHERE id = ?', [userId]);
        if (!user)
            return { success: false, error: 'Пользователь не найден' };
        const names = ['Сердцевина бездны', 'Рунный булыжник'];
        const counts = [1000, 1200];
        const inventory = JSON.parse(user.inventory || '[]');
        for (let i = 0; i < names.length; i++) {
            const item = await index_1.db.one("SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = ?", [names[i]]);
            if (!item) {
                logger_1.default.warn(`[Donate] craft_rare_200: item not found: ${names[i]}`);
                continue;
            }
            const existing = inventory.find((i) => (i.type === 'craft_item' || i.type === 'material') && i.id === item.id);
            if (existing) {
                existing.count = (existing.count || 0) + counts[i];
            }
            else {
                inventory.push({
                    type: 'craft_item', id: item.id, name: item.name,
                    rarity_id: item.rarity_id, rarity_display: item.rarity_display, rarity_color: item.rarity_color,
                    count: counts[i], itemType: item.type || 'craft', image: item.image || null,
                });
            }
        }
        const newBank = (user.bank || 0) + 2000000;
        await index_1.db.run('UPDATE users SET inventory = ?, bank = ? WHERE id = ?', [JSON.stringify(inventory), newBank, userId]);
        (0, events_1.sendToUser)(userId, { type: 'paymentStatus', status: 'success', platform: 'donate' });
        logger_1.default.info(`[Donate] Craft rare ×200 delivered to user ${userId}: 1000 cores + 1200 stones + 2M silver to bank`);
        return { success: true };
    }
    catch (err) {
        logger_1.default.error(`[Donate] deliverCraftRare200 error: ${err.message}`);
        return { success: false, error: err.message };
    }
}
//# sourceMappingURL=donate.js.map