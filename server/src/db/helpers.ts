import type Database from 'better-sqlite3';

type DB = InstanceType<typeof Database>;

// --- Подготовленные запросы (ленивая инициализация) ---

let _getItemData: any;
export function getItemDataStmt(db: DB) {
  if (!_getItemData) {
    _getItemData = db.prepare(`
      SELECT i.rarity_id, i.image, r.display_name as rarity_display, r.color as rarity_color
      FROM items i JOIN rarities r ON i.rarity_id = r.id
      WHERE i.name = ? AND i.slot = ?
    `);
  }
  return _getItemData;
}

// --- Данные пользователя ---

export function getUserById(db: DB, userId: number) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
}

export function getUserWithStats(db: DB, userId: number) {
  return db.prepare(
    'SELECT id, username, level, money, exp, totalBattles, wins, inventory, equipment, currentHp, lastHpUpdate, lastAttackTime, protectionUntil, inventorySlots, activeJob, chatBannedUntil, openPrivateTabs, gender, statPoints, baseS, baseA, baseD, baseM FROM users WHERE id = ?'
  ).get(userId) as any;
}

// --- Статы ---

export function getBaseStats(user: any) {
  return {
    s: user.baseS ?? 5,
    a: user.baseA ?? 5,
    d: user.baseD ?? 5,
    m: user.baseM ?? 5,
  };
}

export function getMaxHp(stats: { hp?: number; s: number; a: number; d: number; m: number }) {
  return stats.hp ?? (stats.s + stats.a + stats.d + stats.m);
}

// --- Экипировка ---

export function enrichEquipment(db: DB, equipment: Record<string, any>): { enriched: Record<string, any>; changed: boolean } {
  const stmt = getItemDataStmt(db);
  let changed = false;
  const enriched: Record<string, any> = {};

  for (const [slotId, item] of Object.entries(equipment)) {
    if (item && item.slot && item.rarity_id === undefined) {
      const row = stmt.get(item.name, item.slot) as any;
      if (row) {
        changed = true;
        enriched[slotId] = {
          ...item,
          rarity_id: row.rarity_id,
          rarity_display: row.rarity_display,
          rarity_color: row.rarity_color,
          image: row.image || item.image || null,
        };
      } else {
        enriched[slotId] = item;
      }
    } else {
      enriched[slotId] = item;
    }
  }

  return { enriched, changed };
}

// --- HP ---

export function recalcHpOnEquip(currentHp: number, oldMaxHp: number, newMaxHp: number) {
  return Math.max(1, Math.floor(currentHp * newMaxHp / (oldMaxHp || 1)));
}

// --- Деньги ---

export function transferMoney(db: DB, fromUserId: number, toUserId: number, amount: number) {
  const stmt = db.prepare('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?');
  const result = stmt.run(amount, fromUserId, amount);
  if (result.changes === 0) return false;
  db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(amount, toUserId);
  return true;
}

export function addMoney(db: DB, userId: number, amount: number) {
  db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(amount, userId);
}

export function spendMoney(db: DB, userId: number, amount: number): boolean {
  const result = db.prepare('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?').run(amount, userId, amount);
  return result.changes > 0;
}
