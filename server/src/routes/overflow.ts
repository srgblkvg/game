import { Router } from 'express';
import { db } from '../db/index';
import { takeOverflowItem } from '../game/overflowTake';
import { createPgOverflowTakeRepository } from '../game/overflowTakeRepository';
import { addOverflowItem } from '../game/overflowAdd';
import { createPgOverflowAddRepository } from '../game/overflowAddRepository';

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
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Неверный ID предмета' });

  try {
    const result = await takeOverflowItem(createPgOverflowTakeRepository(), {
      overflowId: id,
      userId,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    const message = error?.message || 'Не удалось забрать предмет';
    if (message === 'Предмет не найден' || message === 'Пользователь не найден') {
      return res.status(404).json({ error: message });
    }
    if (message === 'Инвентарь заполнен') return res.status(400).json({ error: message });
    console.error('[overflow/take]', error);
    res.status(500).json({ error: 'Не удалось забрать предмет' });
  }
});

// Добавить предмет на склад (вызывается из аукциона)
export async function addToOverflow(userId: number, item: any, auctionLotId?: number) {
  await addOverflowItem(createPgOverflowAddRepository(), auctionLotId === undefined
    ? { userId, item }
    : { userId, item, auctionLotId });
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
