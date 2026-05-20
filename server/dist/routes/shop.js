"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
router.get('/shop/items', (req, res) => {
    const items = database_1.default.prepare('SELECT * FROM items').all();
    const result = items.map((item) => ({
        ...item,
        bonuses: JSON.parse(item.bonuses || '{}'),
        extra: JSON.parse(item.extra || '{}'),
        price: 100 * Math.pow(10, item.rarity),
    }));
    res.json(result);
});
router.post('/shop/buy', (req, res) => {
    const parsed = validation_1.buyItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const userId = req.userId;
    const { itemId } = parsed.data;
    const user = database_1.default.prepare('SELECT money, inventory, inventorySlots FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const dbItem = database_1.default.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
    if (!dbItem)
        return res.status(404).json({ error: 'Item not found' });
    const price = 100 * Math.pow(10, dbItem.rarity);
    if (user.money < price)
        return res.status(400).json({ error: 'Недостаточно монет' });
    // Проверка заполненности инвентаря
    const inventory = JSON.parse(user.inventory || '[]');
    const equipmentCount = inventory.filter((item) => !item.type || (item.type !== 'material' && item.type !== 'craft_item')).length;
    const inventorySlots = user.inventorySlots || 10;
    if (equipmentCount >= inventorySlots) {
        return res.status(400).json({ error: 'Инвентарь заполнен' });
    }
    const newItem = {
        id: Date.now() + Math.random(),
        name: dbItem.name,
        slot: dbItem.slot,
        rarity: dbItem.rarity,
        bonuses: JSON.parse(dbItem.bonuses || '{}'),
        extra: JSON.parse(dbItem.extra || '{}'),
        image: dbItem.image || null,
    };
    inventory.push(newItem);
    database_1.default.prepare('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?')
        .run(price, JSON.stringify(inventory), userId);
    res.json({ success: true, moneyAfter: user.money - price });
});
exports.default = router;
//# sourceMappingURL=shop.js.map