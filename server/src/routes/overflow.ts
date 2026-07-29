import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

// Получить все предметы на складе
router.get('/', async (req: any, res) => {
  const userId = req.userId;
  const items = await db.query(
    'SELECT id, item, auctionlotid as auctionLotId, createdat as createdAt FROM overflow_storage WHERE userId = ? ORDER BY id',
    [userId]
  ) as any[];
  res.json(items.map((r: any) => ({
    id: r.id,
    item: typeof r.item === 'string' ? JSON.parse(r.item) : r.item,
    auctionLotId: r.auctionlotid ?? r.auctionLotId ?? null,
    createdAt: r.createdat ?? r.createdAt,
  })));
});

// Забрать предмет в инвентарь
router.post('/take/:id', async (req: any, res) => {
  const userId = req.userId;
  const id = parseInt(req.params.id);

  const row = await db.one('SELECT * FROM overflow_storage WHERE id = ? AND userId = ?', [id, userId]) as any;
  if (!row) return res.status(404).json({ error: 'Предмет не найден' });

  const user = await db.one('SELECT inventory, inventorySlots FROM users WHERE id = ?', [userId]) as any;
  const inventory = typeof user.inventory === 'string' ? JSON.parse(user.inventory) : (user.inventory || []);
  const maxSlots = user.inventorySlots || 10;
  const item = typeof row.item === 'string' ? JSON.parse(row.item) : row.item;
  const isGear = !!item.slot;
  const isCraft = item.type === 'craft_item' || item.type === 'material' || item.type === 'upgrade';
  const equipCount = inventory.filter((i: any) => !!i.slot).length;

  if (isGear && equipCount >= maxSlots) {
    return res.status(400).json({ error: 'Инвентарь заполнен' });
  }

  // Стакаем ресурсы в инвентаре
  if (isCraft) {
    const existingIdx = inventory.findIndex((i: any) =>
      (i.type === 'craft_item' || i.type === 'material' || i.type === 'upgrade') && String(i.id) === String(item.id)
    );
    if (existingIdx !== -1) {
      inventory[existingIdx].count = (inventory[existingIdx].count || 0) + (item.count || 1);
      await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
      await db.run('DELETE FROM overflow_storage WHERE id = ?', [id]);
      return res.json({ success: true, inventory, remainingSlots: maxSlots - inventory.length, stacked: true });
    }
  }

  inventory.push(item);
  await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
  await db.run('DELETE FROM overflow_storage WHERE id = ?', [id]);

  res.json({ success: true, inventory, remainingSlots: maxSlots - inventory.length });
});

// Добавить предмет на склад (вызывается из аукциона)
export async function addToOverflow(userId: number, item: any, auctionLotId?: number) {
  // Стакаем ресурсы: если такой же уже на складе — увеличиваем count
  const isCraft = item.type === 'craft_item' || item.type === 'material' || item.type === 'upgrade';
  if (isCraft) {
    const rows = await db.query(
      "SELECT id, item FROM overflow_storage WHERE userId = ? AND item->>'id' = ? AND item->>'type' = ? LIMIT 1",
      [userId, String(item.id), item.type]
    ) as any[];
    if (rows.length > 0) {
      const existing = rows[0];
      const existingItem = typeof existing.item === 'string' ? JSON.parse(existing.item) : existing.item;
      existingItem.count = (existingItem.count || 0) + (item.count || 1);
      await db.run('UPDATE overflow_storage SET item = ? WHERE id = ?', [JSON.stringify(existingItem), existing.id]);
      return;
    }
  }
  await db.run(
    'INSERT INTO overflow_storage (userId, item, auctionLotId) VALUES (?, ?, ?)',
    [userId, JSON.stringify(item), auctionLotId || null]
  );
}

// Получить + вывести серебро со склада
router.get('/money', async (req: any, res) => {
  const userId = req.userId;
  const u = await db.one('SELECT overflowmoney FROM users WHERE id = ?', [userId]) as any;
  res.json({ overflowmoney: u?.overflowmoney || 0 });
});

router.post('/money/withdraw', async (req: any, res) => {
  const userId = req.userId;
  const amount = parseInt(req.body.amount) || 0;
  if (amount <= 0) return res.status(400).json({ error: 'Укажите сумму' });
  const u = await db.one('SELECT overflowmoney FROM users WHERE id = ?', [userId]) as any;
  if (!u || (u.overflowmoney || 0) < amount) return res.status(400).json({ error: 'Недостаточно на складе' });
  await db.run('UPDATE users SET money = money + ?, overflowmoney = overflowmoney - ? WHERE id = ?', [amount, amount, userId]);
  res.json({ success: true, withdrawn: amount, remaining: (u.overflowmoney || 0) - amount });
});

// Проверить заполненность инвентаря
export async function isInventoryFull(userId: number): Promise<boolean> {
  const u = await db.one('SELECT inventory, inventorySlots FROM users WHERE id = ?', [userId]) as any;
  const inv = typeof u.inventory === 'string' ? JSON.parse(u.inventory) : (u.inventory || []);
  return inv.length >= (u.inventoryslots || u.inventorySlots || 10);
}

export default router;
