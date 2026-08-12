"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const treasury_1 = require("../game/treasury");
const router = (0, express_1.Router)();
const DAILY_LIMIT = 10;
// Получить все предметы (для коллекций)
router.get('/items', async (req, res) => {
    const items = await index_1.db.query(`
        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color, r.id as rarity_id
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        ORDER BY i.id
    `, []);
    const result = items.map((item) => ({
        ...item,
        bonuses: JSON.parse(item.bonuses || '{}'),
        extra: JSON.parse(item.extra || '{}'),
        price: item.cost ?? Math.floor(100 * Math.pow(10, item.rarity_id)),
    }));
    res.json(result);
});
// Веса редкостей для генерации
const RARITY_WEIGHTS = [
    [0, 40], [1, 25], [2, 15], [3, 10], [4, 5], [5, 3], [6, 2],
];
const STONE_PRICE = 2000;
const OFFERS_PER_DAY = 10;
async function generateDailyOffers(userId) {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await index_1.db.one('SELECT COUNT(*) as cnt FROM shop_offers WHERE user_id = $1 AND date = $2', [userId, today]);
    if (existing.cnt > 0)
        return;
    // Загружаем все подходящие предметы одним запросом
    const allItems = await index_1.db.query(`SELECT id, rarity_id FROM items WHERE sellable = true 
     AND rarity_id != 7 
     AND (extra IS NULL OR extra::text NOT LIKE '%"set"%')`, []);
    const offers = [];
    // Камни — ровно 1 лот, первый, случайный размер
    const stoneSizes = [1, 3, 5];
    const stoneQty = stoneSizes[Math.floor(Math.random() * stoneSizes.length)];
    const ci = await index_1.db.one('SELECT rarity_id FROM craft_items WHERE id = 8');
    offers.push({ itemId: 8, itemType: 'craft_item', quantity: stoneQty, rarityId: ci.rarity_id });
    // Добираем предметами до 10 (из памяти)
    // Группируем по редкости для быстрого доступа
    const byRarity = new Map();
    for (const item of allItems) {
        if (!byRarity.has(item.rarity_id))
            byRarity.set(item.rarity_id, []);
        byRarity.get(item.rarity_id).push(item);
    }
    const usedIds = new Set();
    let safety = 0;
    while (offers.length < OFFERS_PER_DAY && safety < 1000) {
        safety++;
        const rarity = weightedRandom(RARITY_WEIGHTS);
        const pool = (byRarity.get(rarity) || []).filter((i) => !usedIds.has(i.id));
        if (pool.length === 0)
            continue;
        const item = pool[Math.floor(Math.random() * pool.length)];
        usedIds.add(item.id);
        offers.push({ itemId: item.id, itemType: 'item', quantity: 1, rarityId: item.rarity_id });
    }
    for (const o of offers) {
        await index_1.db.run('INSERT INTO shop_offers (item_id, item_type, quantity, date, rarity_id, user_id) VALUES ($1, $2, $3, $4, $5, $6)', [o.itemId, o.itemType, o.quantity, today, o.rarityId, userId]);
    }
}
function weightedRandom(weights) {
    const total = weights.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [val, w] of weights) {
        r -= w;
        if (r <= 0)
            return val;
    }
    return weights[weights.length - 1][0];
}
router.get('/shop', async (req, res) => {
    const userId = req.userId;
    await generateDailyOffers(userId);
    const today = new Date().toISOString().slice(0, 10);
    const itemOffers = await index_1.db.query(`SELECT o.*, i.name, i.slot, i.bonuses, i.extra, i.image, i.cost,
            r.display_name as rarity_display, r.color as rarity_color
     FROM shop_offers o
     LEFT JOIN items i ON o.item_id = i.id
     LEFT JOIN rarities r ON o.rarity_id = r.id
     WHERE o.user_id = $1 AND o.date = $2 AND o.item_type = 'item'
     ORDER BY o.id`, [userId, today]);
    const craftOffers = await index_1.db.query(`SELECT o.*, c.name, c.image,
            r.display_name as rarity_display, r.color as rarity_color
     FROM shop_offers o
     JOIN craft_items c ON o.item_id = c.id
     JOIN rarities r ON c.rarity_id = r.id
     WHERE o.user_id = $1 AND o.date = $2 AND o.item_type = 'craft_item'
     ORDER BY o.id`, [userId, today]);
    const result = [];
    for (const o of itemOffers) {
        result.push({
            id: o.id, itemId: o.item_id, itemType: 'item', quantity: o.quantity,
            name: o.name, slot: o.slot,
            bonuses: o.bonuses ? JSON.parse(o.bonuses) : {},
            extra: o.extra ? JSON.parse(o.extra) : {},
            image: o.image, rarity_id: o.rarity_id,
            rarity_display: o.rarity_display, rarity_color: o.rarity_color,
            price: o.cost ?? Math.floor(100 * Math.pow(10, o.rarity_id)),
        });
    }
    for (const co of craftOffers) {
        result.push({
            id: co.id, itemId: co.item_id, itemType: 'craft_item', quantity: co.quantity,
            name: `${co.name} ×${co.quantity}`, slot: null,
            bonuses: {}, extra: {}, image: co.image,
            rarity_id: co.rarity_id, rarity_display: co.rarity_display, rarity_color: co.rarity_color,
            price: STONE_PRICE * co.quantity,
        });
    }
    const bought = await index_1.db.query('SELECT offer_id FROM shop_purchases WHERE user_id = $1 AND date = $2', [userId, today]);
    const boughtIds = new Set(bought.map((b) => b.offer_id));
    const todayCount = (await index_1.db.one('SELECT COUNT(*) as cnt FROM shop_purchases WHERE user_id = $1 AND date = $2', [userId, today])).cnt;
    res.json({
        offers: result.map(o => ({ ...o, bought: boughtIds.has(o.id) })),
        todayCount, dailyLimit: DAILY_LIMIT,
        nextRefresh: getNextRefreshTime(),
    });
});
router.post('/shop/buy', async (req, res) => {
    const userId = req.userId;
    const { offerId } = req.body;
    if (!offerId)
        return res.status(400).json({ error: 'Укажите offerId' });
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = (await index_1.db.one('SELECT COUNT(*) as cnt FROM shop_purchases WHERE user_id = $1 AND date = $2', [userId, today])).cnt;
    if (todayCount >= DAILY_LIMIT)
        return res.status(400).json({ error: 'Лимит покупок (10 в сутки)' });
    const already = await index_1.db.one('SELECT id FROM shop_purchases WHERE user_id = $1 AND offer_id = $2 AND date = $3', [userId, offerId, today]).catch(() => null);
    if (already)
        return res.status(400).json({ error: 'Вы уже купили этот товар сегодня' });
    const offer = await index_1.db.one('SELECT * FROM shop_offers WHERE id = $1 AND user_id = $2 AND date = $3', [offerId, userId, today]);
    if (!offer)
        return res.status(404).json({ error: 'Предложение не найдено' });
    let price;
    let itemName;
    if (offer.item_type === 'craft_item') {
        price = STONE_PRICE * offer.quantity;
        const ci = await index_1.db.one('SELECT name FROM craft_items WHERE id = $1', [offer.item_id]);
        itemName = `${ci.name} ×${offer.quantity}`;
    }
    else {
        const item = await index_1.db.one('SELECT name, cost, rarity_id FROM items WHERE id = $1', [offer.item_id]);
        price = item.cost ?? Math.floor(100 * Math.pow(10, item.rarity_id));
        itemName = item.name;
    }
    const user = await index_1.db.one('SELECT money, inventory, inventorySlots FROM users WHERE id = $1', [userId]);
    if (user.money < price)
        return res.status(400).json({ error: `Недостаточно серебра. Нужно ${price}, есть ${user.money}` });
    const inventory = JSON.parse(user.inventory || '[]');
    if (offer.item_type === 'craft_item') {
        const existing = inventory.find((i) => i.type === 'craft_item' && i.id === offer.item_id);
        if (existing) {
            existing.count = (existing.count || 0) + offer.quantity;
        }
        else {
            const ci = await index_1.db.one('SELECT id, name, rarity_id, type, image FROM craft_items WHERE id = $1', [offer.item_id]);
            inventory.push({
                id: ci.id, name: ci.name, type: 'craft_item',
                rarity_id: ci.rarity_id, count: offer.quantity,
                image: ci.image, itemType: ci.type,
            });
        }
    }
    else {
        const equipmentCount = inventory.filter((i) => !i.type || (i.type !== 'material' && i.type !== 'craft_item')).length;
        if (equipmentCount >= (user.inventorySlots || 10))
            return res.status(400).json({ error: 'Инвентарь заполнен' });
        const item = await index_1.db.one('SELECT i.*, r.display_name as rarity_display, r.color as rarity_color FROM items i JOIN rarities r ON i.rarity_id = r.id WHERE i.id = $1', [offer.item_id]);
        inventory.push({
            id: Date.now() + Math.random(), name: item.name, slot: item.slot,
            rarity_id: item.rarity_id, rarity_display: item.rarity_display, rarity_color: item.rarity_color,
            bonuses: JSON.parse(item.bonuses || '{}'), extra: JSON.parse(item.extra || '{}'),
            image: item.image || null,
        });
    }
    await index_1.db.run('UPDATE users SET money = money - $1, inventory = $2 WHERE id = $3', [price, JSON.stringify(inventory), userId]);
    await index_1.db.run('INSERT INTO shop_purchases (user_id, offer_id, date) VALUES ($1, $2, $3)', [userId, offerId, today]);
    (0, treasury_1.addToTreasury)(Math.floor(price * 0.22), 'shop_sale').catch(() => { });
    // Туториал: первая покупка в магазине → шаг 2 (Ремесло)
    await index_1.db.run('UPDATE users SET tutorial_step = 2 WHERE id = ? AND tutorial_step = 1', [userId]);
    res.json({ success: true, moneyAfter: user.money - price, itemName });
});
function getNextRefreshTime() {
    const now = new Date();
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    return Math.floor(next.getTime() / 1000);
}
exports.default = router;
//# sourceMappingURL=shop.js.map