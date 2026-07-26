import { Router } from 'express';
import { db } from '../db/index';
import { addToTreasury } from '../game/treasury';

const router = Router();

const DAILY_LIMIT = 10;

// Получить все предметы (для коллекций)
router.get('/items', async (req, res) => {
    const items = await db.query(`
        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color, r.id as rarity_id
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        ORDER BY i.id
    `, []) as any[];

    const result = items.map((item) => ({
        ...item,
        bonuses: JSON.parse(item.bonuses || '{}'),
        extra: JSON.parse(item.extra || '{}'),
        price: item.cost ?? Math.floor(100 * Math.pow(10, item.rarity_id)),
    }));

    res.json(result);
});

// Веса редкостей для генерации
const RARITY_WEIGHTS: [number, number][] = [
  [0, 40], [1, 25], [2, 15], [3, 10], [4, 5], [5, 3], [6, 2],
];

const STONE_PRICE = 2000;
const OFFERS_PER_DAY = 10;

async function generateDailyOffers() {
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.one('SELECT COUNT(*) as cnt FROM shop_offers WHERE date = $1', [today]) as any;
  if (existing.cnt > 0) return;

  // Загружаем все подходящие предметы одним запросом
  const allItems = await db.query(
    `SELECT id, rarity_id FROM items WHERE sellable = true 
     AND rarity_id != 7 
     AND (extra IS NULL OR extra::text NOT LIKE '%"set"%')`,
    []
  ) as any[];

  const offers: { itemId: number; itemType: string; quantity: number; rarityId: number }[] = [];

  // Камни
  const stonePacks = [
    { id: 8, qty: 1, weight: 8 },
    { id: 8, qty: 3, weight: 5 },
    { id: 8, qty: 5, weight: 3 },
  ];
  const ci = await db.one('SELECT rarity_id FROM craft_items WHERE id = 8') as any;
  for (const pack of stonePacks) {
    if (Math.random() * 100 < pack.weight * 2) {
      offers.push({ itemId: pack.id, itemType: 'craft_item', quantity: pack.qty, rarityId: ci.rarity_id });
    }
  }

  // Добираем предметами до 10 (из памяти)
  // Группируем по редкости для быстрого доступа
  const byRarity = new Map<number, any[]>();
  for (const item of allItems) {
    if (!byRarity.has(item.rarity_id)) byRarity.set(item.rarity_id, []);
    byRarity.get(item.rarity_id)!.push(item);
  }
  const usedIds = new Set<number>();
  let safety = 0;
  while (offers.length < OFFERS_PER_DAY && safety < 1000) {
    safety++;
    const rarity = weightedRandom(RARITY_WEIGHTS);
    const pool = (byRarity.get(rarity) || []).filter((i: any) => !usedIds.has(i.id));
    if (pool.length === 0) continue;
    const item = pool[Math.floor(Math.random() * pool.length)]!;
    usedIds.add(item.id);
    offers.push({ itemId: item.id, itemType: 'item', quantity: 1, rarityId: item.rarity_id });
  }

  for (const o of offers) {
    await db.run(
      'INSERT INTO shop_offers (item_id, item_type, quantity, date, rarity_id) VALUES ($1, $2, $3, $4, $5)',
      [o.itemId, o.itemType, o.quantity, today, o.rarityId]
    );
  }
}

function weightedRandom(weights: [number, number][]): number {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [val, w] of weights) {
    r -= w;
    if (r <= 0) return val;
  }
  return weights[weights.length - 1]![0];
}

router.get('/shop', async (req, res) => {
  await generateDailyOffers();
  const today = new Date().toISOString().slice(0, 10);

  const itemOffers = await db.query(
    `SELECT o.*, i.name, i.slot, i.bonuses, i.extra, i.image, i.cost,
            r.display_name as rarity_display, r.color as rarity_color
     FROM shop_offers o
     LEFT JOIN items i ON o.item_id = i.id
     LEFT JOIN rarities r ON o.rarity_id = r.id
     WHERE o.date = $1 AND o.item_type = 'item'
     ORDER BY o.id`,
    [today]
  ) as any[];

  const craftOffers = await db.query(
    `SELECT o.*, c.name, c.image,
            r.display_name as rarity_display, r.color as rarity_color
     FROM shop_offers o
     JOIN craft_items c ON o.item_id = c.id
     JOIN rarities r ON c.rarity_id = r.id
     WHERE o.date = $1 AND o.item_type = 'craft_item'
     ORDER BY o.id`,
    [today]
  ) as any[];

  const result: any[] = [];

  for (const o of itemOffers) {
    result.push({
      id: o.id, itemId: o.item_id, itemType: 'item', quantity: o.quantity,
      name: o.name, slot: o.slot,
      bonuses: o.bonuses ? JSON.parse(o.bonuses) : {},
      extra: o.extra ? JSON.parse(o.extra) : {},
      image: o.image, rarity_id: o.rarity_id,
      rarity_display: o.rarity_display, rarity_color: o.rarity_color,
      price: o.cost ?? Math.floor(100 * Math.pow(10, o.rarity_id)),
    });
  }

  for (const co of craftOffers) {
    result.push({
      id: co.id, itemId: co.item_id, itemType: 'craft_item', quantity: co.quantity,
      name: `${co.name} ×${co.quantity}`, slot: null,
      bonuses: {}, extra: {}, image: co.image,
      rarity_id: co.rarity_id, rarity_display: co.rarity_display, rarity_color: co.rarity_color,
      price: STONE_PRICE * co.quantity,
    });
  }

  const userId = req.userId;
  const bought = await db.query(
    'SELECT offer_id FROM shop_purchases WHERE user_id = $1 AND date = $2',
    [userId, today]
  ) as any[];
  const boughtIds = new Set(bought.map((b: any) => b.offer_id));

  const todayCount = (await db.one(
    'SELECT COUNT(*) as cnt FROM shop_purchases WHERE user_id = $1 AND date = $2',
    [userId, today]
  ) as any).cnt;

  res.json({
    offers: result.map(o => ({ ...o, bought: boughtIds.has(o.id) })),
    todayCount, dailyLimit: DAILY_LIMIT,
    nextRefresh: getNextRefreshTime(),
  });
});

router.post('/shop/buy', async (req, res) => {
  const userId = req.userId;
  const { offerId } = req.body;
  if (!offerId) return res.status(400).json({ error: 'Укажите offerId' });

  const today = new Date().toISOString().slice(0, 10);

  const todayCount = (await db.one(
    'SELECT COUNT(*) as cnt FROM shop_purchases WHERE user_id = $1 AND date = $2',
    [userId, today]
  ) as any).cnt;
  if (todayCount >= DAILY_LIMIT) return res.status(400).json({ error: 'Лимит покупок (10 в сутки)' });

  const already = await db.one(
    'SELECT id FROM shop_purchases WHERE user_id = $1 AND offer_id = $2 AND date = $3',
    [userId, offerId, today]
  ).catch(() => null);
  if (already) return res.status(400).json({ error: 'Вы уже купили этот товар сегодня' });

  const offer = await db.one(
    'SELECT * FROM shop_offers WHERE id = $1 AND date = $2',
    [offerId, today]
  ) as any;
  if (!offer) return res.status(404).json({ error: 'Предложение не найдено' });

  let price: number;
  let itemName: string;

  if (offer.item_type === 'craft_item') {
    price = STONE_PRICE * offer.quantity;
    const ci = await db.one('SELECT name FROM craft_items WHERE id = $1', [offer.item_id]) as any;
    itemName = `${ci.name} ×${offer.quantity}`;
  } else {
    const item = await db.one('SELECT name, cost, rarity_id FROM items WHERE id = $1', [offer.item_id]) as any;
    price = item.cost ?? Math.floor(100 * Math.pow(10, item.rarity_id));
    itemName = item.name;
  }

  const user = await db.one('SELECT money, inventory, inventorySlots FROM users WHERE id = $1', [userId]) as any;
  if (user.money < price) return res.status(400).json({ error: 'Недостаточно серебра' });

  const inventory = JSON.parse(user.inventory || '[]');

  if (offer.item_type === 'craft_item') {
    const existing = inventory.find((i: any) => i.type === 'craft_item' && i.id === offer.item_id);
    if (existing) {
      existing.count = (existing.count || 0) + offer.quantity;
    } else {
      const ci = await db.one('SELECT id, name, rarity_id, type, image FROM craft_items WHERE id = $1', [offer.item_id]) as any;
      inventory.push({
        id: ci.id, name: ci.name, type: 'craft_item',
        rarity_id: ci.rarity_id, count: offer.quantity,
        image: ci.image, itemType: ci.type,
      });
    }
  } else {
    const equipmentCount = inventory.filter(
      (i: any) => !i.type || (i.type !== 'material' && i.type !== 'craft_item')
    ).length;
    if (equipmentCount >= (user.inventorySlots || 10)) return res.status(400).json({ error: 'Инвентарь заполнен' });

    const item = await db.one(
      'SELECT i.*, r.display_name as rarity_display, r.color as rarity_color FROM items i JOIN rarities r ON i.rarity_id = r.id WHERE i.id = $1',
      [offer.item_id]
    ) as any;

    inventory.push({
      id: Date.now() + Math.random(), name: item.name, slot: item.slot,
      rarity_id: item.rarity_id, rarity_display: item.rarity_display, rarity_color: item.rarity_color,
      bonuses: JSON.parse(item.bonuses || '{}'), extra: JSON.parse(item.extra || '{}'),
      image: item.image || null,
    });
  }

  await db.run('UPDATE users SET money = money - $1, inventory = $2 WHERE id = $3',
    [price, JSON.stringify(inventory), userId]);
  await db.run('INSERT INTO shop_purchases (user_id, offer_id, date) VALUES ($1, $2, $3)',
    [userId, offerId, today]);
  addToTreasury(Math.floor(price * 0.22), 'shop_sale').catch(() => {});

  res.json({ success: true, moneyAfter: user.money - price, itemName });
});

function getNextRefreshTime() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return Math.floor(next.getTime() / 1000);
}

export default router;
