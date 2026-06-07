import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

// Все маршруты аукциона требуют полный доступ
router.use('/auction', requireFullAccess);

// Мин. цены по редкости
const priceFloor: Record<number, number> = { 0: 5, 1: 15, 2: 50, 3: 150, 4: 400, 5: 1000, 6: 3000 };

// API: получить минимальные цены (для клиента)
router.get('/auction/price-floor', (_req, res) => {
    res.json(priceFloor);
});

// Все лоты
router.get('/auction', (req: any, res) => {
    const now = Math.floor(Date.now() / 1000);
    // Закрываем просроченные лоты
    const expired = db.prepare('SELECT * FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NOT NULL').all(now) as any[];
    for (const lot of expired) {
        const commission = Math.floor(lot.currentBid * 0.1);
        const payout = lot.currentBid - commission;
        db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(payout, lot.sellerId);
        db.prepare('DELETE FROM auction_lots WHERE id = ?').run(lot.id);
    }
    // Удаляем непроданные
    db.prepare('DELETE FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NULL').run(now);

    const lots = db.prepare(`
        SELECT l.*, u.username as sellerName, g.name as sellerGuild, u.guildId as sellerGuildId FROM auction_lots l
        JOIN users u ON l.sellerId = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        WHERE l.endsAt > ? ORDER BY l.endsAt ASC
    `).all(now) as any[];

    res.json(lots.map((l: any) => ({ ...l, itemData: JSON.parse(l.itemData) })));
});

// Создать лот
router.post('/auction/sell', (req: any, res) => {
    const userId = req.userId;
    const { itemData, startPrice, buyoutPrice, duration, count } = req.body;

    if (!itemData || !startPrice) return res.status(400).json({ error: 'Нет данных' });

    const isMaterial = itemData.type === 'craft_item' || itemData.type === 'material';
    const itemCount = isMaterial ? Math.max(1, count || (itemData.count || 1)) : 1;

    const rarity = itemData.rarity_id ?? 0;
    const floor = (priceFloor[rarity] || 5);
    // Цена указана за 1 шт — умножаем на количество
    const totalStartPrice = startPrice * itemCount;
    const totalBuyoutPrice = buyoutPrice ? buyoutPrice * itemCount : null;
    if (startPrice < floor) return res.status(400).json({ error: `Мин. цена за 1 шт для этой редкости: ${floor} 🥇` });
    if (buyoutPrice && buyoutPrice <= startPrice) return res.status(400).json({ error: 'Цена выкупа должна быть выше стартовой' });

    // Проверка лимита (5 лотов)
    const userLotCount = (db.prepare('SELECT COUNT(*) as cnt FROM auction_lots WHERE sellerId = ?').get(userId) as any).cnt;
    if (userLotCount >= 5) return res.status(400).json({ error: 'Максимум 5 лотов' });

    // Комиссия за листинг 5% (от общей стартовой цены)
    const listingFee = Math.max(1, Math.floor(totalStartPrice * 0.05));
    const user = db.prepare('SELECT money, inventory FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < listingFee) return res.status(400).json({ error: `Недостаточно монет для листинга (${listingFee} 🥇)` });

    // Убираем предмет из инвентаря
    const inventory = JSON.parse(user.inventory || '[]');
    const idx = inventory.findIndex((i: any) => String(i.id) === String(itemData.id));
    if (idx === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    const invItem = inventory[idx];

    if (isMaterial) {
        const availableCount = invItem.count || 0;
        if (itemCount > availableCount) return res.status(400).json({ error: `Недостаточно: есть ${availableCount}, выбрано ${itemCount}` });
        if (itemCount >= availableCount) {
            // Продаём весь стек
            inventory.splice(idx, 1);
        } else {
            // Продаём часть стека
            invItem.count = availableCount - itemCount;
        }
    } else {
        inventory.splice(idx, 1);
    }

    // Обогащаем itemData количеством
    const sellItemData = { ...itemData, count: itemCount, type: itemData.type || 'item' };

    const now = Math.floor(Date.now() / 1000);
    const dur = duration || 24;
    const endsAt = now + dur * 3600;

    db.prepare('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?').run(listingFee, JSON.stringify(inventory), userId);
    db.prepare(`INSERT INTO auction_lots (sellerId, itemData, startPrice, buyoutPrice, currentBid, duration, endsAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(userId, JSON.stringify(sellItemData), totalStartPrice, totalBuyoutPrice, null, dur, endsAt, now);

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

// Выкуп (buyout) — полный выкуп лота
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

    // Стакаем с существующими материалами
    const isCraft = itemData.type === 'craft_item' || itemData.type === 'material';
    if (isCraft) {
        const existingIdx = inventory.findIndex((i: any) =>
            (i.type === 'craft_item' || i.type === 'material') && String(i.id) === String(itemData.id)
        );
        if (existingIdx !== -1) {
            inventory[existingIdx].count = (inventory[existingIdx].count || 0) + (itemData.count || 1);
        } else {
            inventory.push(itemData);
        }
    } else {
        inventory.push(itemData);
    }

    db.prepare('UPDATE users SET money = money - ?, inventory = ?, auctionTrades = auctionTrades + 1 WHERE id = ?').run(lot.buyoutPrice, JSON.stringify(inventory), userId);
    db.prepare('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?').run(payout, lot.sellerId);
    db.prepare('DELETE FROM auction_lots WHERE id = ?').run(lotId);

    res.json({ success: true });
});

// Купить часть стека (Buy N from stack)
router.post('/auction/buy-partial', (req: any, res) => {
    const userId = req.userId;
    const { lotId, quantity } = req.body;

    if (!lotId || !quantity || quantity < 1) return res.status(400).json({ error: 'Нет данных' });

    const now = Math.floor(Date.now() / 1000);
    const lot = db.prepare('SELECT * FROM auction_lots WHERE id = ? AND endsAt > ?').get(lotId, now) as any;
    if (!lot) return res.status(404).json({ error: 'Лот не найден или истёк' });
    if (lot.sellerId === userId) return res.status(400).json({ error: 'Нельзя купить свой лот' });

    const itemData = JSON.parse(lot.itemData);
    const stackCount = itemData.count || 1;
    if (stackCount <= 1) return res.status(400).json({ error: 'Этот лот нельзя купить частично' });
    if (quantity > stackCount) return res.status(400).json({ error: `В лоте только ${stackCount} шт.` });

    // Цена за штуку: от выкупа (если есть), иначе от ставки/старта
    const totalPrice = lot.buyoutPrice ?? lot.currentBid ?? lot.startPrice;
    const pricePerItem = Math.ceil(totalPrice / stackCount);
    const cost = pricePerItem * quantity;

    const user = db.prepare('SELECT money, inventory FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.money < cost) return res.status(400).json({ error: 'Недостаточно монет' });

    // Комиссия 10% пропорционально
    const commission = Math.floor(cost * 0.1);
    const payout = cost - commission;

    const inventory = JSON.parse(user.inventory || '[]');

    // Добавляем покупателю: если у него уже есть такой же craft_item, увеличиваем count
    const singleItem = { ...itemData, count: quantity };
    const existingIdx = inventory.findIndex((i: any) =>
        (i.type === 'craft_item' || i.type === 'material') && String(i.id) === String(itemData.id)
    );
    if (existingIdx !== -1) {
        inventory[existingIdx].count = (inventory[existingIdx].count || 0) + quantity;
    } else {
        inventory.push(singleItem);
    }

    // Обновляем лот: уменьшаем count
    const remainingCount = stackCount - quantity;
    if (remainingCount <= 0) {
        // Полностью распродано
        db.prepare('DELETE FROM auction_lots WHERE id = ?').run(lotId);
    } else {
        const newItemData = { ...itemData, count: remainingCount };
        const newStartPrice = Math.max(1, Math.floor(lot.startPrice * remainingCount / stackCount));
        const newBuyoutPrice = lot.buyoutPrice ? Math.max(1, Math.floor(lot.buyoutPrice * remainingCount / stackCount)) : null;
        // Пропорционально уменьшаем ставку, если есть
        const newCurrentBid = lot.currentBid ? Math.max(newStartPrice, Math.floor(lot.currentBid * remainingCount / stackCount)) : null;
        db.prepare(`UPDATE auction_lots SET itemData = ?, startPrice = ?, buyoutPrice = ?, currentBid = ? WHERE id = ?`)
            .run(JSON.stringify(newItemData), newStartPrice, newBuyoutPrice, newCurrentBid, lotId);
    }

    // Списываем деньги покупателю и начисляем продавцу
    db.prepare('UPDATE users SET money = money - ?, inventory = ?, auctionTrades = auctionTrades + 1 WHERE id = ?').run(cost, JSON.stringify(inventory), userId);
    db.prepare('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?').run(payout, lot.sellerId);

    res.json({ success: true, cost, remaining: remainingCount });
});

export default router;
