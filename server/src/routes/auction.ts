import { Router } from 'express';
import { db } from '../db/index';
import { checkAchievement } from './achievements';
import { markDirty, pushNotification, broadcast, sendToUser } from '../events';
import { addToOverflow, isInventoryFull } from './overflow';
import { addToTreasury } from '../game/treasury';

const router = Router();

// Хелпер: добавить предмет в инвентарь или overflow при переполнении
async function returnItemToInventory(userId: number, itemData: any) {
    const user = await db.one('SELECT inventory, inventorySlots FROM users WHERE id = ?', [userId]) as any;
    const inventory = JSON.parse(user.inventory || '[]');
    const maxSlots = user.inventoryslots || user.inventorySlots || 10;
    const isCraft = itemData.type === 'craft_item' || itemData.type === 'material';
    const count = itemData.count || 1;

    if (isCraft) {
        const existingIdx = inventory.findIndex((i: any) =>
            (i.type === 'craft_item' || i.type === 'material') && String(i.id) === String(itemData.id)
        );
        if (existingIdx !== -1) {
            inventory[existingIdx].count = (inventory[existingIdx].count || 0) + count;
            await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
            return;
        }
    }

    const equipCount = inventory.filter((i: any) => !!(i.slot)).length;
    if (!isCraft && equipCount >= maxSlots) {
        await addToOverflow(userId, { ...itemData, count });
    } else {
        inventory.push({ ...itemData, count });
        await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    }
}

// Таблица истории сделок
db.run(`CREATE TABLE IF NOT EXISTS auction_history (
    id SERIAL PRIMARY KEY,
    sellerId INTEGER NOT NULL,
    buyerId INTEGER,
    itemName TEXT NOT NULL,
    itemData TEXT,
    price INTEGER NOT NULL,
    commission INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL
)`).catch(() => {});

// Колонка непрочитанных продаж на аукционе
db.run(`ALTER TABLE users ADD COLUMN IF NOT EXISTS auction_sales INTEGER DEFAULT 0`).catch(() => {});

// Мин. цены по редкости
const priceFloor: Record<number, number> = { 0: 5, 1: 20, 2: 100, 3: 400, 4: 1500, 5: 6000, 6: 20000 };

// API: получить минимальные цены (для клиента)
router.get('/auction/price-floor', async (req, res) => {
    res.json(priceFloor);
});

// Статистика похожих лотов (для подсказки при выставлении)
router.get('/auction/similar', async (req, res) => {
    const name = req.query.name as string;
    const slot = req.query.slot as string;
    const rarity = parseInt(req.query.rarity as string) || 0;
    const sellCount = parseInt(req.query.sellCount as string) || 1;
    if (!name) return res.json({ count: 0 });

    const now = Math.floor(Date.now() / 1000);
    const lots = await db.query(
        `SELECT l.startPrice, l.buyoutPrice, l.currentBid, l.itemData
         FROM auction_lots l WHERE l.endsAt > ?`, [now]
    ) as any[];

    const similar = lots.filter(l => {
        try {
            const d = JSON.parse(l.itemData);
            return d.name === name && (d.slot || '') === (slot || '') && (d.rarity_id ?? 0) === rarity;
        } catch { return false; }
    });

    if (similar.length === 0) return res.json({ count: 0 });

    // Делим на количество в лоте, чтобы получить цену за 1 шт
    const getPerUnit = (total: number, itemDataJson: string) => {
        try {
            const d = JSON.parse(itemDataJson);
            const cnt = d.count || 1;
            return cnt > 1 ? Math.ceil(total / cnt) : total;
        } catch { return total; }
    };

    const bids = similar.map(l => getPerUnit(l.currentBid || l.startPrice, l.itemData));
    const buyouts = similar.filter(l => l.buyoutPrice).map(l => getPerUnit(l.buyoutPrice, l.itemData));
    const avgBid = Math.round(bids.reduce((a, b) => a + b, 0) / bids.length);
    const avgBuyout = buyouts.length > 0 ? Math.round(buyouts.reduce((a, b) => a + b, 0) / buyouts.length) : null;
    const minBid = Math.min(...bids);

    // Если продавец выставляет >1 шт — показываем цены за 1 шт
    const perUnit = sellCount > 1;

    res.json({ count: similar.length, avgBid, avgBuyout, minBid, perUnit });
});

// Все лоты
router.get('/auction', async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    // Закрываем просроченные лоты со ставками
    const expired = await db.query('SELECT * FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NOT NULL', [now]) as any[];
    for (const lot of expired) {
        const commission = Math.floor(lot.currentBid * 0.1);
        const payout = lot.currentBid - commission;
        // Заплатить продавцу
        await db.run('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [payout, lot.sellerId]);
        checkAchievement(lot.sellerId, 'auction').catch(() => {});
        // Отдать предмет покупателю (или overflow)
        const buyItemData = JSON.parse(lot.itemData);
        await returnItemToInventory(lot.currentBidderId, buyItemData);
        // Запись в историю
        await db.run(`INSERT INTO auction_history (sellerId, buyerId, itemName, itemData, price, commission, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [lot.sellerId, lot.currentBidderId, JSON.parse(lot.itemData).name || 'Предмет', lot.itemData, lot.currentBid, commission, new Date().toISOString()]);
        addToTreasury(commission, 'auction_expired').catch(() => {});
        // Уведомления
        const buyerName = (await db.one('SELECT username FROM users WHERE id = ?', [lot.currentBidderId]) as any)?.username || 'Кто-то';
        pushNotification(lot.sellerId, { type: 'auction_sold', message: `${buyerName} купил «${JSON.parse(lot.itemData).name || 'Предмет'}» за ${lot.currentBid} серебра` });
        sendToUser(lot.sellerId, { type: 'auction_badge', count: 1 });
        await db.run('UPDATE users SET auction_sales = COALESCE(auction_sales, 0) + 1 WHERE id = ?', [lot.sellerId]);
        pushNotification(lot.currentBidderId, { type: 'system', message: `Вы выиграли «${JSON.parse(lot.itemData).name || 'Предмет'}» на аукционе!` });
        await db.run('DELETE FROM auction_lots WHERE id = ?', [lot.id]);
        await db.run('DELETE FROM chat_messages WHERE item_data LIKE ?', [`%"lotId":${lot.id}%`]);
        broadcast('auction_message_removed', { lotId: lot.id });
    }
    // Возвращаем непроданные лоты продавцам
    const unsold = await db.query('SELECT * FROM auction_lots WHERE endsAt <= ? AND currentBidderId IS NULL', [now]) as any[];
    for (const lot of unsold) {
        const itemData = JSON.parse(lot.itemData);
        await returnItemToInventory(lot.sellerId, itemData);
        pushNotification(lot.sellerId, { type: 'system', message: `Лот «${JSON.parse(lot.itemData).name || 'Предмет'}» не был продан и возвращён` });
        await db.run('DELETE FROM auction_lots WHERE id = ?', [lot.id]);
        await db.run('DELETE FROM chat_messages WHERE item_data LIKE ?', [`%"lotId":${lot.id}%`]);
        broadcast('auction_message_removed', { lotId: lot.id });
    }

    const lots = await db.query(`
        SELECT l.*, u.username as sellerName, g.name as sellerGuild, u.guildId as sellerGuildId,
               b.username as currentBidderName
        FROM auction_lots l
        JOIN users u ON l.sellerId = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        LEFT JOIN users b ON l.currentBidderId = b.id
        WHERE l.endsAt > ? ORDER BY l.endsAt ASC
    `, [now]) as any[];

    const allLots = lots.map((l) => {
      try {
        return { ...l, itemData: JSON.parse(l.itemData) };
      } catch {
        return { ...l, itemData: l.itemData };
      }
    });

    // Client-side filtering/search/pagination
    const page = parseInt(req.query.page as string) || 1;
    const search = (req.query.search as string) || '';
    const category = (req.query.category as string) || 'all';
    const sort = (req.query.sort as string) || 'end';
    const groupFilter = (req.query.group as string) || '';

    let filtered = allLots;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((l: any) => (l.itemData?.name || '').toLowerCase().includes(q));
    }
    if (category && category !== 'all') {
      filtered = filtered.filter((l: any) => {
        const slot = l.itemData?.slot || '';
        if (category === 'weapon') return slot === 'weapon1';
        if (category === 'shield') return slot === 'shield';
        if (category === 'armor') return ['helmet','chest','gloves','boots'].includes(slot);
        if (category === 'accessory') return ['amulet','ring','belt'].includes(slot);
        if (category === 'material') return l.itemData?.type === 'craft_item' || l.itemData?.type === 'material';
        return slot === category;
      });
    }

    // Stat filters
    const statMap: Record<string, string> = { minStr: 's', minAgi: 'a', minDef: 'd', minMag: 'm' };
    for (const [clientKey, statKey] of Object.entries(statMap)) {
      const minVal = parseInt(req.query[clientKey] as string) || 0;
      if (minVal > 0) {
        filtered = filtered.filter((l: any) => (l.itemData?.bonuses?.[statKey] || 0) >= minVal);
      }
    }

    // Sort
    if (sort === 'price_asc') filtered.sort((a: any, b: any) => (a.currentBid || a.startPrice) - (b.currentBid || b.startPrice));
    else if (sort === 'price_desc') filtered.sort((a: any, b: any) => (b.currentBid || b.startPrice) - (a.currentBid || a.startPrice));

    // Группировка ДО group-фильтра
    const groupsMap = new Map<string, { item: any; count: number; minBid: number; minBuyout: number | null }>();
    for (const lot of filtered) {
        const key = `${lot.itemData?.name || ''}|${lot.itemData?.slot || ''}|${lot.itemData?.rarity_id ?? ''}`;
        const bid = lot.currentBid || lot.startPrice;
        const buyout = lot.buyoutPrice || null;
        const existing = groupsMap.get(key);
        if (existing) {
            existing.count++;
            if (bid < existing.minBid) existing.minBid = bid;
            if (buyout !== null && (existing.minBuyout === null || buyout < existing.minBuyout)) existing.minBuyout = buyout;
        } else {
            groupsMap.set(key, {
                item: lot.itemData,
                count: 1,
                minBid: bid,
                minBuyout: buyout,
            });
        }
    }
    const groups = [...groupsMap.values()];

    // Пагинация групп
    const GROUP_LIMIT = 12;
    const groupPage = parseInt(req.query.groupPage as string) || 1;
    const groupTotalCount = groups.length;
    const groupTotalPages = Math.max(1, Math.ceil(groupTotalCount / GROUP_LIMIT));
    const groupActualPage = Math.min(groupPage, groupTotalPages);
    const pagedGroups = groups.slice((groupActualPage - 1) * GROUP_LIMIT, groupActualPage * GROUP_LIMIT);

    // Group-фильтр ПОСЛЕ группировки
    if (groupFilter) {
      filtered = filtered.filter((l: any) => {
        const key = `${l.itemData?.name || ''}|${l.itemData?.slot || ''}|${l.itemData?.rarity_id ?? ''}`;
        return key === groupFilter;
      });
    }

    const limit = 6;
    const totalCount = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const actualPage = page;

    const myLotCount = (await db.one('SELECT COUNT(*) as cnt FROM auction_lots WHERE sellerId = ? AND endsat > ?', [req.userId, Math.floor(Date.now() / 1000)]) as any).cnt;

    const highlightLot = parseInt(req.query.highlightLot as string) || 0;
    if (highlightLot && page === 1) {
        const idx = filtered.findIndex((l: any) => l.id === highlightLot);
        if (idx !== -1) {
            const targetPage = Math.floor(idx / limit) + 1;
            if (targetPage !== 1) {
                const paged = filtered.slice((targetPage - 1) * limit, targetPage * limit);
                return res.json({ lots: paged, groups: pagedGroups, totalCount, totalPages, page: targetPage, myLotCount, highlightLot, groupTotalCount, groupTotalPages, groupPage: groupActualPage });
            }
        }
    }
    const paged = filtered.slice((actualPage - 1) * limit, actualPage * limit);

    res.json({ lots: paged, groups: pagedGroups, totalCount, totalPages, page, myLotCount, groupTotalCount, groupTotalPages, groupPage: groupActualPage });
});

// Создать лот
router.post('/auction/sell', async (req, res) => {
    const userId = req.userId;
    const { itemData, startPrice, buyoutPrice, duration, count } = req.body;

    if (!itemData || !startPrice) return res.status(400).json({ error: 'Нет данных' });

    const isMaterial = itemData.type === 'craft_item' || itemData.type === 'material';
    const itemCount = isMaterial ? Math.max(1, count || (itemData.count || 1)) : 1;

    const rarity = itemData.rarity_id ?? 0;
    const isUpgrade = itemData.itemType === 'upgrade';
    const floor = isUpgrade ? 2000 : (priceFloor[rarity] || 5);
    // Цена указана за 1 шт — умножаем на количество
    const totalStartPrice = startPrice * itemCount;
    const totalBuyoutPrice = buyoutPrice ? buyoutPrice * itemCount : null;
    if (startPrice < floor) return res.status(400).json({ error: `Мин. цена за 1 шт для этой редкости: ${floor} серебра` });
    if (buyoutPrice && buyoutPrice <= startPrice) return res.status(400).json({ error: 'Цена выкупа должна быть выше стартовой' });

    // Проверка лимита (5 лотов)
    const userLotCount = (await db.one('SELECT COUNT(*) as cnt FROM auction_lots WHERE sellerId = ? AND endsat > ?', [userId, Math.floor(Date.now() / 1000)]) as any).cnt;
    if (userLotCount >= 5) return res.status(400).json({ error: 'Максимум 5 лотов' });

    // Комиссия за листинг 5% (от общей стартовой цены)
    const listingFee = Math.max(1, Math.floor(totalStartPrice * 0.05));
    const user = await db.one('SELECT money, inventory FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < listingFee) return res.status(400).json({ error: `Недостаточно монет для листинга (${listingFee} серебра)` });

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
    const lotResult = await db.run(`INSERT INTO auction_lots (sellerId, itemData, startPrice, buyoutPrice, currentBid, duration, endsAt, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, JSON.stringify(sellItemData), totalStartPrice, totalBuyoutPrice, null, dur, endsAt, now]);
    const lotId = lotResult.lastInsertRowid;

    addToTreasury(listingFee, 'auction_listing').catch(() => {});

    // Системное сообщение в чат (вкладка Аукцион)
    const sellerName = (await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any)?.username || 'Кто-то';
    const auctionItemData = JSON.stringify({
      type: 'auction_lot',
      lotId,
      itemData: sellItemData,
      startPrice: totalStartPrice,
      currentBid: null,
      buyoutPrice: totalBuyoutPrice,
      currentBidderName: null,
      sellerName,
      endsAt,
      createdAt: now,
    });
    const chatInfo = await db.run(
      'INSERT INTO chat_messages (senderId, targetId, content, item_data, senderguild, senderguildid) VALUES (?, NULL, ?, ?, NULL, NULL)',
      [0, `📦 ${sellerName} выставил лот`, auctionItemData]
    );
    const chatMsg = {
      id: chatInfo.lastInsertRowid,
      senderId: 0,
      senderName: 'Глашатай',
      targetId: null,
      content: `📦 ${sellerName} выставил лот`,
      createdAt: new Date().toISOString(),
      item: { type: 'auction_lot', lotId, itemData: sellItemData, startPrice: totalStartPrice, currentBid: null, buyoutPrice: totalBuyoutPrice, currentBidderName: null, sellerName, endsAt },
    };
    broadcast('message', { message: chatMsg });

    broadcast('auction_changed', {});
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
            if (amount < minBid) throw new Error(`Мин. ставка: ${minBid} серебра`);

            const user = (await client.query('SELECT money FROM users WHERE id = $1', [userId])).rows[0] as any;
            if (!user || user.money < amount) throw new Error('Недостаточно монет');

            // Возврат денег предыдущему лидеру
            if (lot.currentbidderid) {
                await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [currentBid, lot.currentbidderid]);
            }

            await client.query('UPDATE users SET money = money - $1 WHERE id = $2', [amount, userId]);
            await client.query('UPDATE auction_lots SET currentBid = $1, currentBidderId = $2 WHERE id = $3', [amount, userId, lotId]);
        });

        broadcast('auction_changed', { lotId });

        // Системное сообщение о перебивке ставки
        const lot = await db.one('SELECT * FROM auction_lots WHERE id = ?', [lotId]) as any;
        if (lot) {
          const itemData = JSON.parse(lot.itemdata || lot.itemData || '{}');
          const bidderName = (await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any)?.username || 'Кто-то';
          const prevBidderId = lot.currentbidderid;
          const previousBidderName = (prevBidderId && prevBidderId !== userId)
            ? ((await db.one('SELECT username FROM users WHERE id = ?', [prevBidderId]) as any)?.username || 'Кто-то')
            : null;
          const auctionItemData = JSON.stringify({
            type: 'auction_bid',
            lotId,
            itemData,
            startPrice: parseInt(lot.startprice) || 0,
            currentBid: amount,
            buyoutPrice: lot.buyoutprice || null,
            currentBidderName: bidderName,
            previousBidderName,
            sellerName: (await db.one('SELECT username FROM users WHERE id = ?', [lot.sellerid || lot.sellerId]) as any)?.username || 'Кто-то',
            endsAt: lot.endsat || lot.endsAt,
            createdAt: Math.floor(Date.now() / 1000),
          });
          const chatInfo = await db.run(
            'INSERT INTO chat_messages (senderId, targetId, content, item_data, senderguild, senderguildid) VALUES (?, NULL, ?, ?, NULL, NULL)',
            [0, `💰 ${bidderName} перебил ставку`, auctionItemData]
          );
          const chatMsg = {
            id: chatInfo.lastInsertRowid,
            senderId: 0,
            senderName: 'Глашатай',
            targetId: null,
            content: `💰 ${bidderName} перебил ставку`,
            createdAt: new Date().toISOString(),
            item: { type: 'auction_bid', lotId, itemData, startPrice: parseInt(lot.startprice) || 0, currentBid: amount, buyoutPrice: lot.buyoutprice || null, currentBidderName: bidderName, previousBidderName, sellerName: (await db.one('SELECT username FROM users WHERE id = ?', [lot.sellerid || lot.sellerId]) as any)?.username || 'Кто-то', endsAt: lot.endsat || lot.endsAt },
          };
          broadcast('message', { message: chatMsg });
        }
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

    // Добавляем предмет покупателю (или overflow)
    await returnItemToInventory(userId, itemData);

    await db.run('UPDATE users SET money = money - ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [lot.buyoutPrice, userId]);
    await db.run('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [payout, lot.sellerId]);
    checkAchievement(lot.sellerId, 'auction').catch(() => {});
    await db.run('DELETE FROM auction_lots WHERE id = ?', [lotId]);
    await db.run('DELETE FROM chat_messages WHERE item_data LIKE ?', [`%"lotId":${lotId}%`]);
    broadcast('auction_message_removed', { lotId });

    // Daily quests — track auction trades
    markDirty(userId, 'quests');
    markDirty(lot.sellerId, 'quests');

    // Запись в историю
    const buyItemData = JSON.parse(lot.itemData);
    await db.run(`INSERT INTO auction_history (sellerId, buyerId, itemName, itemData, price, commission, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lot.sellerId, userId, buyItemData.name || 'Предмет', lot.itemData, lot.buyoutPrice, commission, new Date().toISOString()]);
    addToTreasury(commission, 'auction_buyout').catch(() => {});

    // Уведомление продавцу — прямой WS + toast
    const buyerName = (await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any)?.username || 'Кто-то';
    pushNotification(lot.sellerId, { type: 'auction_sold', message: `${buyerName} выкупил «${buyItemData.name || 'Предмет'}» за ${lot.buyoutPrice} серебра` });
    sendToUser(lot.sellerId, { type: 'auction_badge', count: 1 });
    await db.run('UPDATE users SET auction_sales = COALESCE(auction_sales, 0) + 1 WHERE id = ?', [lot.sellerId]);

    broadcast('auction_changed', {});

    // Системное сообщение о выкупе лота
    const buyoutItemData = JSON.stringify({
      type: 'auction_buyout',
      lotId,
      itemData: buyItemData,
      price: lot.buyoutPrice,
      buyerName,
      sellerName: (await db.one('SELECT username FROM users WHERE id = ?', [lot.sellerId]) as any)?.username || 'Кто-то',
    });
    const buyoutChatInfo = await db.run(
      'INSERT INTO chat_messages (senderId, targetId, content, item_data, senderguild, senderguildid) VALUES (?, NULL, ?, ?, NULL, NULL)',
      [0, `✅ ${buyerName} выкупил лот за ${lot.buyoutPrice} серебра`, buyoutItemData]
    );
    const buyoutChatMsg = {
      id: buyoutChatInfo.lastInsertRowid,
      senderId: 0,
      senderName: 'Глашатай',
      targetId: null,
      content: `✅ ${buyerName} выкупил лот за ${lot.buyoutPrice} серебра`,
      createdAt: new Date().toISOString(),
      item: { type: 'auction_buyout', lotId, itemData: buyItemData, price: lot.buyoutPrice, buyerName },
    };
    broadcast('message', { message: buyoutChatMsg });

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
    if (!user || user.money < cost) return res.status(400).json({ error: `Недостаточно серебра. Нужно ${cost}, есть ${user?.money || 0}` });

    // Комиссия 10% пропорционально
    const commission = Math.floor(cost * 0.1);
    const payout = cost - commission;

    const inventory = JSON.parse(user.inventory || '[]');

    // Добавляем покупателю
    await returnItemToInventory(userId, { ...itemData, count: quantity });

    // Обновляем лот: уменьшаем count
    const remainingCount = stackCount - quantity;
    if (remainingCount <= 0) {
        // Полностью распродано
        await db.run('DELETE FROM auction_lots WHERE id = ?', [lotId]);
    await db.run('DELETE FROM chat_messages WHERE item_data LIKE ?', [`%"lotId":${lotId}%`]);
    broadcast('auction_message_removed', { lotId });
    } else {
        const newItemData = { ...itemData, count: remainingCount };
        const newStartPrice = Math.max(1, Math.floor(lot.startPrice * remainingCount / stackCount));
        const newBuyoutPrice = lot.buyoutPrice ? Math.max(1, Math.floor(lot.buyoutPrice * remainingCount / stackCount)) : null;
        // Пропорционально уменьшаем ставку, если есть
        const newCurrentBid = lot.currentBid ? Math.max(newStartPrice, Math.floor(lot.currentBid * remainingCount / stackCount)) : null;
        await db.run(`UPDATE auction_lots SET itemData = ?, startPrice = ?, buyoutPrice = ?, currentBid = ? WHERE id = ?`,
            [JSON.stringify(newItemData), newStartPrice, newBuyoutPrice, newCurrentBid, lotId]);
        // Вернуть разницу лидеру ставки
        if (lot.currentBidderId && newCurrentBid && newCurrentBid < lot.currentBid) {
            const refund = lot.currentBid - newCurrentBid;
            await db.run('UPDATE users SET money = money + ? WHERE id = ?', [refund, lot.currentBidderId]);
        }
    }

    // Списываем деньги покупателю и начисляем продавцу
    await db.run('UPDATE users SET money = money - ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [cost, userId]);
    await db.run('UPDATE users SET money = money + ?, auctionTrades = auctionTrades + 1 WHERE id = ?', [payout, lot.sellerId]);
    checkAchievement(lot.sellerId, 'auction').catch(() => {});

    // Daily quests — track auction trades
    markDirty(userId, 'quests');
    markDirty(lot.sellerId, 'quests');

    // Запись в историю
    await db.run(`INSERT INTO auction_history (sellerId, buyerId, itemName, itemData, price, commission, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [lot.sellerId, userId, itemData.name || 'Предмет', JSON.stringify({ ...itemData, count: quantity }), cost, commission, new Date().toISOString()]);
    addToTreasury(commission, 'auction_partial').catch(() => {});

    broadcast('auction_changed', {});
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

    // Возвращаем предмет в инвентарь (или overflow если заполнен)
    await returnItemToInventory(userId, itemData);

    // Возвращаем деньги текущему лидеру ставок
    if (lot.currentBidderId && lot.currentBid) {
        await db.run('UPDATE users SET money = money + ? WHERE id = ?', [lot.currentBid, lot.currentBidderId]);
    }

    // Удаляем лот
    await db.run('DELETE FROM auction_lots WHERE id = ?', [lotId]);
    await db.run('DELETE FROM chat_messages WHERE item_data LIKE ?', [`%"lotId":${lotId}%`]);
    broadcast('auction_message_removed', { lotId });

    res.json({ success: true, message: 'Лот снят с аукциона' });
});

// Сброс бейджа при заходе на аукцион
router.post('/auction/reset-badge', async (req, res) => {
    const userId = req.userId;
    await db.run('UPDATE users SET auction_sales = 0 WHERE id = ?', [userId]);
    res.json({ success: true });
});

// История сделок
router.get('/auction/history', async (req, res) => {
    const userId = req.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const totalRow = await db.one('SELECT COUNT(*) as cnt FROM auction_history', []) as any;
    const total = totalRow?.cnt || 0;

    const history = await db.query(`
        SELECT h.*, s.username as sellerName, b.username as buyerName
        FROM auction_history h
        JOIN users s ON h.sellerId = s.id
        LEFT JOIN users b ON h.buyerId = b.id
        ORDER BY h.id DESC
        LIMIT ? OFFSET ?
    `, [limit, offset]);

    res.json({ history, total, page, totalPages: Math.ceil(total / limit) });
});

export default router;
