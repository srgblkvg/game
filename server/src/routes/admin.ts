import { Router } from 'express';
import db from '../database';
import { createItemSchema, addMoneySchema, resetTimersSchema } from '../validation';

const router = Router();

// ---------- Предметы ----------
router.get('/items', (req: any, res) => {
    const items = db.prepare(`
        SELECT i.*, r.name as rarity_name, r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        ORDER BY i.id DESC
    `).all();
    res.json(items);
});

router.post('/items', (req: any, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });

    const { name, slot, rarity_id, bonuses, extra, image, cost } = parsed.data;
    db.prepare('INSERT INTO items (name, slot, rarity_id, bonuses, extra, image, cost) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(name, slot, rarity_id, JSON.stringify(bonuses || {}), JSON.stringify(extra || {}), image || null, cost ?? null);
    res.json({ success: true });
});

router.put('/items/:id', (req: any, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });

    const { name, slot, rarity_id, bonuses, extra, image, cost } = parsed.data;
    db.prepare('UPDATE items SET name=?, slot=?, rarity_id=?, bonuses=?, extra=?, image=?, cost=? WHERE id=?')
        .run(name, slot, rarity_id, JSON.stringify(bonuses || {}), JSON.stringify(extra || {}), image || null, cost ?? null, req.params.id);
    res.json({ success: true });
});

router.delete('/items/:id', (req: any, res) => {
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// ---------- Игроки ----------
router.get('/users', (req: any, res) => {
    const users = db.prepare('SELECT id, username, level, money, totalBattles, wins, lastAttackTime, protectionUntil, activeJob, inventorySlots FROM users ORDER BY id').all();
    res.json(users);
});

router.post('/add-money', (req: any, res) => {
    const parsed = addMoneySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { userId, amount } = parsed.data;
    const user = db.prepare('SELECT id, money FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    const newMoney = user.money + amount;
    db.prepare('UPDATE users SET money = ? WHERE id = ?').run(newMoney, userId);
    res.json({ success: true, newMoney });
});

router.post('/reset-timers', (req: any, res) => {
    const parsed = resetTimersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { all, userId } = parsed.data;
    if (all) {
        db.prepare('UPDATE users SET lastAttackTime = 0, protectionUntil = 0').run();
        return res.json({ success: true });
    }
    if (!userId) return res.status(400).json({ error: 'userId required' });
    db.prepare('UPDATE users SET lastAttackTime = 0, protectionUntil = 0 WHERE id = ?').run(userId);
    res.json({ success: true });
});

// Получить список редкостей
router.get('/rarities', (req: any, res) => {
    const rarities = db.prepare('SELECT * FROM rarities ORDER BY id').all();
    res.json(rarities);
});

export default router;