import { Router } from 'express';
import db from '../database';
import { createItemSchema, addMoneySchema, resetTimersSchema } from '../validation';

const router = Router();

router.get('/items', (req: any, res) => {
    const items = db.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
    res.json(items);
});

router.post('/items', (req: any, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });

    const { name, slot, rarity, bonuses, extra, image } = parsed.data; // image добавлено
    db.prepare('INSERT INTO items (name, slot, rarity, bonuses, extra, image) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, slot, rarity, JSON.stringify(bonuses || {}), JSON.stringify(extra || {}), image || null);
    res.json({ success: true });
});


router.put('/items/:id', (req: any, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });

    const { name, slot, rarity, bonuses, extra, image } = parsed.data;
    db.prepare('UPDATE items SET name=?, slot=?, rarity=?, bonuses=?, extra=?, image=? WHERE id=?')
        .run(name, slot, rarity, JSON.stringify(bonuses), JSON.stringify(extra), image || null, req.params.id);
    res.json({ success: true });
});

router.delete('/items/:id', (req: any, res) => {
    db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

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

export default router;