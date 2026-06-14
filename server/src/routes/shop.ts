import { Router } from 'express';
import db from '../database';
import { buyItemSchema } from '../validation';

const router = Router();

// Получить все предметы для магазина
router.get('/shop/items', async (req, res) => {
    const items = await db.prepare(`
        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color, r.id as rarity_id
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        ORDER BY i.id
    `).all() as any[];

    const result = items.map((item) => ({
        ...item,
        bonuses: JSON.parse(item.bonuses || '{}'),
        extra: JSON.parse(item.extra || '{}'),
        price: item.cost ?? Math.floor(100 * Math.pow(10, item.rarity_id)),
    }));

    res.json(result);
});

// Купить предмет
router.post('/shop/buy', async (req, res) => {
    const parsed = buyItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const userId = req.userId;
    const { itemId } = parsed.data;

    const user = await db.prepare('SELECT money, inventory, inventorySlots FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dbItem = await db.prepare(`
        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        WHERE i.id = ?
    `).get(itemId) as any;
    if (!dbItem) return res.status(404).json({ error: 'Item not found' });

    const price = dbItem.cost ?? Math.floor(100 * Math.pow(10, dbItem.rarity_id));
    if (user.money < price) return res.status(400).json({ error: 'Недостаточно монет' });

    const inventory = JSON.parse(user.inventory || '[]');
    const equipmentCount = inventory.filter(
        (item: any) => !item.type || (item.type !== 'material' && item.type !== 'craft_item')
    ).length;
    const inventorySlots = user.inventorySlots || 10;
    if (equipmentCount >= inventorySlots) {
        return res.status(400).json({ error: 'Инвентарь заполнен' });
    }

    const newItem = {
        id: Date.now() + Math.random(),
        name: dbItem.name,
        slot: dbItem.slot,
        rarity_id: dbItem.rarity_id,
        rarity_display: dbItem.rarity_display,
        rarity_color: dbItem.rarity_color,
        bonuses: JSON.parse(dbItem.bonuses || '{}'),
        extra: JSON.parse(dbItem.extra || '{}'),
        image: dbItem.image || null,
    };

    inventory.push(newItem);

    await db.prepare('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?')
        .run(price, JSON.stringify(inventory), userId);

    res.json({ success: true, moneyAfter: user.money - price });
});

export default router;