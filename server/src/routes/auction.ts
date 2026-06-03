import { Router } from 'express';
import db from '../database';

const router = Router();

// Мин. цены по редкости
const priceFloor: Record<number, number> = { 0: 5, 1: 15, 2: 50, 3: 150, 4: 400, 5: 1000, 6: 3000 };

// Все лоты
router.get('/auction', (req: any, res) => {
    const now = Math.floor(Date.now() / 1000);
    // Закрываем просроченные лоты
    const expired = db.prepare('SELECT * FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NOT NULL').all(now) as any[];
    for (const lot of expired) {
        const seller = db.prepare('SELECT money FROM users WHERE id = ?').get(lot.sellerId) as any;
        const commission = Math.floor(lot.currentBid * 0.1);
        const payout = lot.currentBid - commission;
        db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(payout, lot.sellerId);
        db.prepare('DELETE FROM auction_lots WHERE id = ?').run(lot.id);
    }
    // Удаляем непроданные
    db.prepare('DELETE FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NULL').run(now);

    const lots = db.prepare(`
        SELECT l.*, u.username as sellerName FROM auction_lots l
        JOIN users u ON l.sellerId = u.id
        WHERE l.endsAt > ? ORDER BY l.endsAt ASC
    `).all(now) as any[];

    res.json(lots.map((l: any) => ({ ...l, itemData: JSON.parse(l.itemData) })));
});

// Создать лот
router.post('/auction/sell', (req: any, res) => {
    const userId = req.userId;
    const { itemData, startPrice, buyoutPrice, duration } = req.body;

    if (!itemData || !startPrice) return res.status(400).json({ error: 'Нет данных' });

    const rarity = itemData.rarity_id ?? 0;
    const floor = priceFloor[rarity] || 5;
    if (startPrice < floor) return res.status(400).json({ error: `Мин. цена для этой редкости: ${floor} 🥇` });

    // Проверка лимита (5 лотов)
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM auction_lots WHERE sellerId = ?').get(userId) as any).cnt;
    if (count >= 5) return res.status(400).json({ error: 'Максимум 5 лотов одновременно' });

    // Комиссия за листинг 5%
    const listingFee = Math.max(1, Math.floor(startPrice * 0.05));
    const user = db.prepare('SELECT money, inventory FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < listingFee) return res.status(400).json({ error: `Недостаточно монет для листинга (${listingFee} 🥇)` });

    // Убираем предмет из инвентаря
    const inventory = JSON.parse(user.inventory || '[]');
    const idx = inventory.findIndex((i: any) => i.id === itemData.id);
    if (idx === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    inventory.splice(idx, 1);

    const now = Math.floor(Date.now() / 1000);
    const dur = duration || 24;
    const endsAt = now + dur * 3600;

    db.prepare('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?').run(listingFee, JSON.stringify(inventory), userId);
    db.prepare(`INSERT INTO auction_lots (sellerId, itemData, startPrice, buyoutPrice, currentBid, duration, endsAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, JSON.stringify(itemData), startPrice, buyoutPrice || null, null, dur, endsAt, now);

    res.json({ success: true, listingFee });
});

// Сделать ставку
router.post('/auction/bid', (req: any, res) => {
    const userId = req.userId;
    const { lotId, amount } = req.body;
    if (!lotId || !amount) return res.status(400).json({ error: 'Нет данных' });

    const now = Math.floor(Date.now() / 1000);
    const lot = db.prepare('SELECT * FROM auction_lots WHERE id = ? AND endsAt > ?').get(lotId, now) as any;
    if (!lot) return res.status(404).json({ error: 'Лот не найден или истёк' });
    if (lot.sellerId === userId) return res.status(400).json({ error: 'Нельзя ставить на свой лот' });

    const minBid = lot.currentBid ? Math.floor(lot.currentBid * 1.05) : lot.startPrice;
    if (amount < minBid) return res.status(400).json({ error: `Мин. ставка: ${minBid} 🥇` });

    const user = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.money < amount) return res.status(400).json({ error: 'Недостаточно монет' });

    // Возврат денег предыдущему лидеру
    if (lot.currentBidderId) {
        db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(lot.currentBid, lot.currentBidderId);
    }

    db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(amount, userId);
    db.prepare('UPDATE auction_lots SET currentBid = ?, currentBidderId = ? WHERE id = ?').run(amount, userId, lotId);

    res.json({ success: true });
});

// Выкуп (buyout)
router.post('/auction/buyout', (req: any, res) => {
    const userId = req.userId;
    const { lotId } = req.body;

    const now = Math.floor(Date.now() / 1000);
    const lot = db.prepare('SELECT * FROM auction_lots WHERE id = ? AND endsAt > ?').get(lotId, now) as any;
    if (!lot) return res.status(404).json({ error: 'Лот не найден' });
    if (!lot.buyoutPrice) return res.status(400).json({ error: 'У лота нет выкупа' });
    if (lot.sellerId === userId) return res.status(400).json({ error: 'Нельзя купить свой лот' });

    const user = db.prepare('SELECT money, inventory FROM users WHERE id = ?').get(userId) as any;
    if (user.money < lot.buyoutPrice) return res.status(400).json({ error: 'Недостаточно монет' });

    const commission = Math.floor(lot.buyoutPrice * 0.1);
    const payout = lot.buyoutPrice - commission;

    // Возврат предыдущему лидеру
    if (lot.currentBidderId) {
        db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(lot.currentBid, lot.currentBidderId);
    }

    const itemData = JSON.parse(lot.itemData);
    const inventory = JSON.parse(user.inventory || '[]');
    inventory.push(itemData);

    db.prepare('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?').run(lot.buyoutPrice, JSON.stringify(inventory), userId);
    db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(payout, lot.sellerId);
    db.prepare('DELETE FROM auction_lots WHERE id = ?').run(lotId);

    res.json({ success: true });
});

export default router;
