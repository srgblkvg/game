import { Router } from 'express';
import { compareAuctionLots } from '../game/auctionSort';
import { db } from '../db/index';
import { checkAchievement } from './achievements';
import { markDirty, pushNotification, broadcast, sendToUser } from '../events';
import { buyoutAuctionLot } from '../game/auctionBuyout';
import { createPgAuctionBuyoutRepository } from '../game/auctionBuyoutRepository';
import { systemClock } from '../clock';
import { purchasePartialAuctionLot } from '../game/auctionPartial';
import { createPgAuctionPartialRepository } from '../game/auctionPartialRepository';
import { cancelAuctionLot } from '../game/auctionCancel';
import { createPgAuctionCancelRepository } from '../game/auctionCancelRepository';
import { placeAuctionBid } from '../game/auctionBid';
import { createPgAuctionBidRepository } from '../game/auctionBidRepository';
import { AUCTION_PRICE_FLOOR, sellAuctionLot } from '../game/auctionSell';
import { createPgAuctionSellRepository } from '../game/auctionSellRepository';

const router = Router();


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

// Мин. цены по редкости
// API: получить минимальные цены (для клиента)
router.get('/auction/price-floor', async (req, res) => {
    res.json(AUCTION_PRICE_FLOOR);
});

// Статистика похожих лотов (для подсказки при выставлении)
router.get('/auction/similar', async (req, res) => {
    const name = req.query.name as string;
    const slot = req.query.slot as string;
    const rarity = parseInt(req.query.rarity as string) || 0;
    const upgLevel = parseInt(req.query.upgradeLevel as string) || 0;
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
            return d.name === name && (d.slot || '') === (slot || '') && (d.rarity_id ?? 0) === rarity && (d.upgradeLevel ?? 0) === upgLevel;
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

    // Все режимы сортировки сравнивают стековые товары по цене одной единицы.
    filtered.sort(compareAuctionLots(sort));

    // Группировка ДО group-фильтра
    const groupsMap = new Map<string, { item: any; count: number; minBid: number; minBuyout: number | null; isStack: boolean; lastBidder: string | null }>();
    for (const lot of filtered) {
        const key = `${lot.itemData?.name || ''}|${lot.itemData?.slot || ''}|${lot.itemData?.rarity_id ?? ''}|${lot.itemData?.upgradeLevel ?? 0}`;
        const itemData = lot.itemData || {};
        const isStack = (itemData.type === 'craft_item' || itemData.type === 'material' || itemData.type === 'upgrade') && (itemData.count || 1) > 1;
        const stackSize = isStack ? (itemData.count || 1) : 1;
        const bid = Math.ceil((lot.currentBid || lot.startPrice) / stackSize);
        const buyout = lot.buyoutPrice ? Math.ceil(lot.buyoutPrice / stackSize) : null;
        const existing = groupsMap.get(key);
        if (existing) {
            existing.count++;
            if (bid < existing.minBid) existing.minBid = bid;
            if (buyout !== null && (existing.minBuyout === null || buyout < existing.minBuyout)) existing.minBuyout = buyout;
            // Последняя ставка — у лота с наибольшим currentBid
            if (lot.currentBidderName && (lot.currentBid || 0) >= (existing as any)._maxBid) {
                existing.lastBidder = lot.currentBidderName;
                (existing as any)._maxBid = lot.currentBid || 0;
            }
        } else {
            groupsMap.set(key, {
                item: lot.itemData,
                count: 1,
                minBid: bid,
                minBuyout: buyout,
                isStack,
                lastBidder: lot.currentBidderName || null,
            });
            (groupsMap.get(key) as any)._maxBid = lot.currentBid || 0;
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
        const key = `${l.itemData?.name || ''}|${l.itemData?.slot || ''}|${l.itemData?.rarity_id ?? ''}|${l.itemData?.upgradeLevel ?? 0}`;
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

// Собственные активные лоты — отдельно от фильтров и пагинации покупки.
router.get('/auction/my-lots', async (req, res) => {
    const now = Math.floor(Date.now() / 1000);
    const lots = await db.query(`
        SELECT l.*, u.username as sellerName, g.name as sellerGuild,
               b.username as currentBidderName
        FROM auction_lots l
        JOIN users u ON l.sellerId = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        LEFT JOIN users b ON l.currentBidderId = b.id
        WHERE l.sellerId = ? AND l.endsAt > ?
        ORDER BY l.endsAt ASC
    `, [req.userId, now]) as any[];

    res.json({
        lots: lots.map(lot => {
            try { return { ...lot, itemData: JSON.parse(lot.itemData) }; }
            catch { return { ...lot, itemData: lot.itemData }; }
        }),
    });
});

// Создать лот
router.post('/auction/sell', async (req, res) => {
    const userId = req.userId;
    const { itemData, startPrice, buyoutPrice, duration, count } = req.body;

    if (itemData?.id === undefined || itemData?.id === null || startPrice === undefined || startPrice === null) {
        return res.status(400).json({ error: 'Нет данных' });
    }
    try {
        const sellInput = {
            sellerId: userId,
            itemId: itemData.id,
            startPrice: Number(startPrice),
            buyoutPrice: buyoutPrice === undefined || buyoutPrice === null || buyoutPrice === ''
                ? null : Number(buyoutPrice),
            now: systemClock.nowSec(),
            ...(duration === undefined || duration === null ? {} : { duration: Number(duration) }),
            ...(count === undefined || count === null ? {} : { count: Number(count) }),
        };
        const result = await sellAuctionLot(createPgAuctionSellRepository(), sellInput);
        try {
            broadcast('message', { message: {
                id: result.chatMessageId, senderId: 0, senderName: 'Глашатай', targetId: null,
                content: `📦 ${result.sellerName} выставил лот`, createdAt: result.createdAt,
                item: { type: 'auction_lot', lotId: result.lotId, itemData: result.item,
                    startPrice: result.startPrice, currentBid: null, buyoutPrice: result.buyoutPrice,
                    currentBidderName: null, sellerName: result.sellerName, endsAt: result.endsAt },
            } });
        } catch (effectError) {
            console.error('[auction-sell] message broadcast failed:', effectError);
        }
        try {
            broadcast('auction_changed', {});
        } catch (effectError) {
            console.error('[auction-sell] auction broadcast failed:', effectError);
        }
        res.json({ success: true, listingFee: result.listingFee });
    } catch (e: any) {
        res.status(400).json({ error: e?.message || 'Ошибка выставления лота' });
    }
});

// Сделать ставку
router.post('/auction/bid', async (req, res) => {
    const userId = req.userId;
    const { lotId, amount } = req.body;
    if (!lotId || !amount) return res.status(400).json({ error: 'Нет данных' });
    try {
        const result = await placeAuctionBid(createPgAuctionBidRepository(), {
            lotId: Number(lotId), bidderId: userId, amount: Number(amount), now: systemClock.nowSec(),
        });
        broadcast('auction_changed', { lotId: result.lotId });
        broadcast('message', { message: {
            id: result.chatMessageId,
            senderId: 0,
            senderName: 'Глашатай',
            targetId: null,
            content: `💰 ${result.bidderName} перебил ставку`,
            createdAt: result.createdAt,
            item: {
                type: 'auction_bid', lotId: result.lotId, itemData: result.item,
                startPrice: result.startPrice, currentBid: result.currentBid,
                buyoutPrice: result.buyoutPrice, currentBidderName: result.bidderName,
                previousBidderName: result.previousBidderName,
                sellerName: result.sellerName, endsAt: result.endsAt,
            },
        } });
        res.json({ success: true });
    } catch (e: any) {
        const message = e?.message || 'Ошибка ставки';
        res.status(message === 'Лот не найден или истёк' ? 404 : 400).json({ error: message });
    }
});

// Выкуп (buyout) — полный выкуп лота
router.post('/auction/buyout', async (req, res) => {
    const userId = req.userId;
    const { lotId } = req.body;
    if (!lotId) return res.status(400).json({ error: 'Нет данных' });
    try {
        await buyoutAuctionLot(createPgAuctionBuyoutRepository(), {
            committed: (result) => {
                checkAchievement(result.sellerId, 'auction').catch(() => {});
                markDirty(result.buyerId, 'quests');
                markDirty(result.sellerId, 'quests');
                pushNotification(result.sellerId, {
                    type: 'auction_sold',
                    message: `${result.buyerName} выкупил «${result.itemName}» за ${result.price} серебра`,
                });
                sendToUser(result.sellerId, { type: 'auction_badge', count: 1 });
                broadcast('auction_message_removed', { lotId: result.lotId });
                broadcast('auction_changed', {});
                broadcast('message', { message: {
                    id: result.chatMessageId,
                    senderId: 0,
                    senderName: 'Глашатай',
                    targetId: null,
                    content: `✅ ${result.buyerName} выкупил лот за ${result.price} серебра`,
                    createdAt: result.createdAt,
                    item: {
                        type: 'auction_buyout', lotId: result.lotId, itemData: result.item,
                        price: result.price, buyerName: result.buyerName,
                    },
                } });
            },
        }, { lotId: Number(lotId), buyerId: userId, now: systemClock.nowSec() });
        res.json({ success: true });
    } catch (error: any) {
        const message = error?.message || 'Ошибка выкупа';
        res.status(message === 'Лот не найден' ? 404 : 400).json({ error: message });
    }
});

// Купить часть стека (Buy N from stack)
router.post('/auction/buy-partial', async (req, res) => {
    const userId = req.userId;
    const { lotId, quantity } = req.body;
    if (!lotId || !quantity || quantity < 1) return res.status(400).json({ error: 'Нет данных' });
    try {
        const result = await purchasePartialAuctionLot(createPgAuctionPartialRepository(), {
            lotId: Number(lotId), buyerId: userId, quantity: Number(quantity), now: systemClock.nowSec(),
        });
        checkAchievement(result.sellerId, 'auction').catch(() => {});
        markDirty(userId, 'quests');
        markDirty(result.sellerId, 'quests');
        broadcast('auction_changed', { lotId: result.lotId });
        if (result.removeLot) broadcast('auction_message_removed', { lotId: result.lotId });
        res.json({ success: true, cost: result.cost, remaining: result.remainingCount });
    } catch (error: any) {
        const message = error?.message || 'Ошибка покупки';
        res.status(message === 'Лот не найден или истёк' ? 404 : 400).json({ error: message });
    }
});

// Снять лот с аукциона
router.post('/auction/cancel', async (req, res) => {
    const userId = req.userId;
    const { lotId } = req.body;
    if (!lotId) return res.status(400).json({ error: 'Укажите lotId' });
    try {
        await cancelAuctionLot(createPgAuctionCancelRepository(), {
            committed: (result) => {
                broadcast('auction_message_removed', { lotId: result.lotId });
                broadcast('auction_changed', { lotId: result.lotId });
            },
        }, { lotId: Number(lotId), sellerId: userId, now: systemClock.nowSec() });
        res.json({ success: true, message: 'Лот снят с аукциона' });
    } catch (error: any) {
        const message = error?.message || 'Ошибка отмены лота';
        res.status(message === 'Лот не найден или истёк' ? 404 : 400).json({ error: message });
    }
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

// История цен для графика (последние 30 дней, группировка по дням)
router.get('/auction/price-history', async (req, res) => {
    const name = req.query.name as string;
    const slot = req.query.slot as string;
    const rarity = parseInt(req.query.rarity as string) || 0;
    const upgLevel = parseInt(req.query.upgradeLevel as string) || 0;
    if (!name) return res.json({ points: [] });

    const rows = await db.query(`
        SELECT
            DATE(createdAt::timestamp) as day,
            COUNT(*) as count,
            ROUND(AVG(price::numeric / GREATEST(COALESCE((itemData::jsonb->>'count')::numeric, 1), 1)))::int as avg_price,
            ROUND(MIN(price::numeric / GREATEST(COALESCE((itemData::jsonb->>'count')::numeric, 1), 1)))::int as min_price,
            ROUND(MAX(price::numeric / GREATEST(COALESCE((itemData::jsonb->>'count')::numeric, 1), 1)))::int as max_price
        FROM auction_history
        WHERE itemName = ?
          AND COALESCE(itemData::jsonb->>'slot', '') = ?
          AND COALESCE((itemData::jsonb->>'rarity_id')::int, 0) = ?
          AND COALESCE((itemData::jsonb->>'upgradeLevel')::int, 0) = ?
          AND createdAt::timestamp > NOW() - INTERVAL '30 days'
        GROUP BY DATE(createdAt::timestamp)
        ORDER BY day ASC
    `, [name, slot, rarity, upgLevel]) as any[];

    res.json({ points: rows });
});

export default router;
