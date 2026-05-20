import { Router } from 'express';
import db from '../database';
import { buyItemSchema } from '../validation';

const router = Router();

router.get('/shop/items', (req: any, res) => {
    const items = db.prepare('SELECT * FROM items').all() as any[];
    const result = items.map((item: any) => ({
        ...item,
        bonuses: JSON.parse(item.bonuses || '{}'),
        extra: JSON.parse(item.extra || '{}'),
        price: 100 * Math.pow(10, item.rarity),
    }));
    res.json(result);
});

router.post('/shop/buy', (req: any, res) => {
    const parsed = buyItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const userId = req.userId;
    const { itemId } = parsed.data;

    const user = db.prepare('SELECT money, inventory, inventorySlots FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dbItem = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId) as any;
    if (!dbItem) return res.status(404).json({ error: 'Item not found' });

    const price = 100 * Math.pow(10, dbItem.rarity);
    if (user.money < price) return res.status(400).json({ error: 'Недостаточно монет' });

    // Проверка заполненности инвентаря
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
        rarity: dbItem.rarity,
        bonuses: JSON.parse(dbItem.bonuses || '{}'),
        extra: JSON.parse(dbItem.extra || '{}'),
        image: dbItem.image || null,
    };

    inventory.push(newItem);

    db.prepare('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?')
        .run(price, JSON.stringify(inventory), userId);

    res.json({ success: true, moneyAfter: user.money - price });
});

export default router;