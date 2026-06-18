import { Router } from 'express';
import { db } from '../db/index';
import { requireFullAccess } from '../middleware/auth';
import { markDirty } from '../websocket';

const router = Router();

// Таблица истории сделок
db.run(`CREATE TABLE IF NOT EXISTS auction_history (
    id SERIAL PRIMARY KEY,
    sellerId INTEGER NOT NULL,
    buyerId INTEGER NOT NULL,
    itemName TEXT NOT NULL,
    itemData TEXT,
    price INTEGER NOT NULL,
    commission INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
)`).catch(() => {});

// Мин. цены по редкости
const priceFloor: Record<number, number> = { 0: 5, 1: 15, 2: 50, 3: 150, 4: 400, 5: 1000, 6: 3000 };

// API: получить минимальные цены (для клиента)
router.get('/auction/price-floor', async (req, res) => {
    res.json(priceFloor);
});

// Все лоты
router.get('/auction', async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    // Закрываем просроченные лоты
    const expired = await db.query('SELECT * FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NOT NULL', [now]) as any[];
    for (const lot of expired) {
        const commission = Math.floor(lot.currentBid * 0.1);
        const payout = lot.currentBid - commission;
        await db.run('UPDATE users SET money = money + ? WHERE id = ?', [payout, lot.sellerId]);
        await db.run('DELETE FROM auction_lots WHERE id = ?', [lot.id]);
    }
    // Удаляем непроданные
    await db.run('DELETE FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NULL', [now]);

    const lots = await db.query(`
        SELECT l.*, u.username as sellerName, g.name as sellerGuild, u.guildId as sellerGuildId,
               b.username as currentBidderName
        FROM auction_lots l
        JOIN users u ON l.sellerId = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        LEFT JOIN users b ON l.currentBidderId = b.id
        WHERE l.endsAt > ? ORDER BY l.endsAt ASC
    `, [now]) as any[];

    res.json(lots.map((l) => ({ ...l, itemData: JSON.parse(l.itemData) })));
});

// Создать лот
router.post('/auction/sell', async (req, res) => {
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
    const userLotCount = (await db.one('SELECT COUNT(*) as cnt FROM auction_lots WHERE sellerId = ?', [userId]) as any).cnt;
    if (userLotCount >= 5) return res.status(400).json({ error: 'Максимум 5 лотов' });

    // Комиссия за листинг 5% (от общей стартовой цены)
    const listingFee = Math.max(1, Math.floor(totalStartPrice * 0.05));
    const user = await db.one('SELECT money, inventory FROM users WHERE id = ?', [userId]) as any;
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

    await db.run('UPDATE users SET money = money - ?, inventory = ? WHERE id = ?', [listingFee, JSON.stringify(inventory), userId]);
    await db.run(`INSERT INTO auction_lots (sellerId, itemData, startPrice, buyoutPrice, currentBid, duration, endsAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, JSON.stringify(sellItemData), totalStartPrice, totalBuyoutPrice, null, dur, endsAt, now]);

    res.json({ success: true, listingFee });
});

// Сделать ставку
router.post('/auction/bid', async (req, res) => {
    const userId = req.userId;
    const { lotId, amount } = req.body;
    if (!lotId || !amount) return res.status(400).json({ error: 'Нет данных' });

    try {
        await db.tx(async (client) => {
            const now = Math.floor(Date.now() / 1000);
            const lot = (await client.query('SELECT * FROM auction_lots WHERE id = $1 AND endsAt > $2 FOR UPDATE', [lotId, now])).rows[0] as any;
            if (!lot) throw new Error('Лот не найден или истёк');
            if (lot.sellerid === userId) throw new Error('Нельзя ставить на свой лот');

            const currentBid = lot.currentbid ? parseInt(lot.currentbid) : null;
            const minBid = currentBid ? currentBid + Math.max(1, Math.floor(currentBid * 0.05)) : parseInt(lot.startprice);
            if (amount < minBid) throw new Error(`Мин. ставка: ${minBid} 🥇`);

            const user = (await client.query('SELECT money FROM users WHERE id = $1', [userId])).rows[0] as any;
            if (!user || user.money < amount) throw new Error('Недостаточно монет');

            // Возврат денег предыдущему лидеру
            if (lot.currentbidderid) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [currentBid, lot.currentbidderid]);
            }

            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [amount, userId]);
            await client.query('UPDATE auction_lots SET currentBid = $1, currentBidderId = $2 WHERE id = $3', [amount, userId, lotId]);
        });

        res.json({ success: true });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// Выкуп (buyout) — полный выкуп лота
router.post('/auction/buyout', async (req, res) => {
    const userId = req.userId;
    const { lotId } = req.body;

    const now = Math.floor(Date.now() / 1000);
    const lot = await db.one('SELECT * FROM auction_lots WHERE id = ? AND endsAt > ?', [lotId, now]) as any;
    if (!lot) return res.status(404).json({ error: 'Лот не найден' });
    if (!lot.buyoutPrice) return res.status(400).json({ error: 'У лота нет выкупа' });
    if (lot.sellerId === userId) return res.status(400).json({ error: 'Нельзя купить свой лот' });

    const user = await db.one('SELECT money, inventory FROM users WHERE id = ?', [userId]) as any;
    if (user.money < lot.buyoutPrice) return res.status(400).json({ error: 'Недостаточно монет' });

    const commission = Math.floor(lot.buyoutPrice * 0.1);
    const payout = lot.buyoutPrice - commission;

    // Возврат предыдущему лидеру
    if (lot.currentBidderId) {
        await db.run('UPDATE users SET money = money + ? WHERE id = ?', [lot.currentBid, lot.currentBidderId]);
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

    await db.run('UPDATE users SET money = money - ?, inventory = ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [lot.buyoutPrice, JSON.stringify(inventory), userId]);
    await db.run('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [payout, lot.sellerId]);
    await db.run('DELETE FROM auction_lots WHERE id = ?', [lotId]);

    // Daily quests — track auction trades
    markDirty(userId, 'quests');
    markDirty(lot.sellerId, 'quests');

    // Запись в историю
    const buyItemData = JSON.parse(lot.itemData);
    await db.run(`INSERT INTO auction_history (sellerId, buyerId, itemName, itemData, price, commission, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lot.sellerId, userId, buyItemData.name || 'Предмет', lot.itemData, lot.buyoutPrice, commission, new Date().toISOString()]);

    res.json({ success: true });
});

// Купить часть стека (Buy N from stack)
router.post('/auction/buy-partial', async (req, res) => {
    const userId = req.userId;
    const { lotId, quantity } = req.body;

    if (!lotId || !quantity || quantity < 1) return res.status(400).json({ error: 'Нет данных' });

    const now = Math.floor(Date.now() / 1000);
    const lot = await db.one('SELECT * FROM auction_lots WHERE id = ? AND endsAt > ?', [lotId, now]) as any;
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

    const user = await db.one('SELECT money, inventory FROM users WHERE id = ?', [userId]) as any;
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
        await db.run('DELETE FROM auction_lots WHERE id = ?', [lotId]);
    } else {
        const newItemData = { ...itemData, count: remainingCount };
        const newStartPrice = Math.max(1, Math.floor(lot.startPrice * remainingCount / stackCount));
        const newBuyoutPrice = lot.buyoutPrice ? Math.max(1, Math.floor(lot.buyoutPrice * remainingCount / stackCount)) : null;
        // Пропорционально уменьшаем ставку, если есть
        const newCurrentBid = lot.currentBid ? Math.max(newStartPrice, Math.floor(lot.currentBid * remainingCount / stackCount)) : null;
        await db.run(`UPDATE auction_lots SET itemData = ?, startPrice = ?, buyoutPrice = ?, currentBid = ? WHERE id = ?`,
            [JSON.stringify(newItemData), newStartPrice, newBuyoutPrice, newCurrentBid, lotId]);
    }

    // Списываем деньги покупателю и начисляем продавцу
    await db.run('UPDATE users SET money = money - ?, inventory = ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [cost, JSON.stringify(inventory), userId]);
    await db.run('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [payout, lot.sellerId]);

    // Daily quests — track auction trades
    markDirty(userId, 'quests');
    markDirty(lot.sellerId, 'quests');

    // Запись в историю
    await db.run(`INSERT INTO auction_history (sellerId, buyerId, itemName, itemData, price, commission, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lot.sellerId, userId, itemData.name || 'Предмет', JSON.stringify(singleItem), cost, commission, new Date().toISOString()]);

    res.json({ success: true, cost, remaining: remainingCount });
});

// Снять лот с аукциона
router.post('/auction/cancel', async (req, res) => {
    const userId = req.userId;
    const { lotId } = req.body;
    if (!lotId) return res.status(400).json({ error: 'Укажите lotId' });

    const now = Math.floor(Date.now() / 1000);
    const lot = await db.one('SELECT * FROM auction_lots WHERE id = ? AND endsAt > ?', [lotId, now]) as any;
    if (!lot) return res.status(404).json({ error: 'Лот не найден или истёк' });
    if (lot.sellerId !== userId) return res.status(400).json({ error: 'Это не ваш лот' });

    const itemData = JSON.parse(lot.itemData);

    // Возвращаем предмет в инвентарь
    const user = await db.one('SELECT inventory FROM users WHERE id = ?', [userId]) as any;
    const inventory = JSON.parse(user.inventory || '[]');
    const existingIdx = inventory.findIndex((i: any) =>
        (i.type === 'craft_item' || i.type === 'material') && String(i.id) === String(itemData.id)
    );
    if (existingIdx !== -1) {
        inventory[existingIdx].count = (inventory[existingIdx].count || 0) + (itemData.count || 1);
    } else {
        inventory.push({ ...itemData, count: itemData.count || 1 });
    }
    await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);

    // Возвращаем деньги текущему лидеру ставок
    if (lot.currentBidderId && lot.currentBid) {
        await db.run('UPDATE users SET money = money + ? WHERE id = ?', [lot.currentBid, lot.currentBidderId]);
    }

    // Удаляем лот
    await db.run('DELETE FROM auction_lots WHERE id = ?', [lotId]);

    res.json({ success: true, message: 'Лот снят с аукциона' });
});

// История сделок
router.get('/auction/history', async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 30;

    const history = await db.query(`
        SELECT h.*, s.username as sellerName, b.username as buyerName
        FROM auction_history h
        JOIN users s ON h.sellerId = s.id
        JOIN users b ON h.buyerId = b.id
        ORDER BY h.id DESC
        LIMIT ?
    `, [limit]);

    res.json(history);
});

export default router;
