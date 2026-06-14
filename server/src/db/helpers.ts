import { db } from '../db/index';

// --- Подготовленные запросы (ленивая инициализация) ---

let _getItemSQL: string;
function getItemSQL() {
  if (!_getItemSQL) {
    _getItemSQL = `
      SELECT i.rarity_id, i.image, r.display_name as rarity_display, r.color as rarity_color
      FROM items i JOIN rarities r ON i.rarity_id = r.id
      WHERE i.name = ? AND i.slot = ?
    `;
  }
  return _getItemSQL;
}

// --- Данные пользователя ---

export async function getUserById(userId: number) {
  return db.one('SELECT u.*, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?', [userId]);
}

export async function getUserWithStats(userId: number) {
  return db.one(
    'SELECT u.id, u.username, u.level, u.money, u.exp, u.totalBattles, u.wins, u.inventory, u.equipment, u.currentHp, u.lastHpUpdate, u.lastAttackTime, u.protectionUntil, u.inventorySlots, u.activeJob, u.chatBannedUntil, u.openPrivateTabs, u.gender, u.statPoints, u.baseS, u.baseA, u.baseD, u.baseM, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?',
    [userId]
  );
}

// --- Статы (чистые функции) ---

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

export async function enrichEquipment(equipment: Record<string, any>): Promise<{ enriched: Record<string, any>; changed: boolean }> {
  const sql = getItemSQL();
  let changed = false;
  const enriched: Record<string, any> = {};

  for (const [slotId, item] of Object.entries(equipment)) {
    if (item && item.slot && item.rarity_id === undefined) {
      const row = await db.one(sql, [item.name, item.slot]);
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

// --- HP (чистая функция) ---

export function recalcHpOnEquip(currentHp: number, oldMaxHp: number, newMaxHp: number) {
  return Math.max(1, Math.floor(currentHp * newMaxHp / (oldMaxHp || 1)));
}

// --- Деньги ---

export async function transferMoney(fromUserId: number, toUserId: number, amount: number) {
  const result = await db.run('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?', [amount, fromUserId, amount]);
  if (result.changes === 0) return false;
  await db.run('UPDATE users SET money = money + ? WHERE id = ?', [amount, toUserId]);
  return true;
}

export async function addMoney(userId: number, amount: number) {
  await db.run('UPDATE users SET money = money + ? WHERE id = ?', [amount, userId]);
}

export async function spendMoney(userId: number, amount: number): Promise<boolean> {
  const result = await db.run('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?', [amount, userId, amount]);
  return result.changes > 0;
}

// --- Налог гильдии ---
export async function collectGuildTax(userId: number, income: number, source: string): Promise<number> {
  if (income <= 0) return income;
  const member = await db.one(
    'SELECT gm.guildId, g.taxRate FROM guild_members gm JOIN guilds g ON gm.guildId = g.id WHERE gm.userId = ?',
    [userId]
  );
  if (!member || !member.taxRate || member.taxRate <= 0) return income;

  const tax = Math.max(1, Math.floor(income * member.taxRate / 100));
  if (tax <= 0) return income;

  await db.run('UPDATE guilds SET treasury = treasury + ? WHERE id = ?', [tax, member.guildId]);
  await db.run('INSERT INTO guild_treasury_log (guildId, userId, amount, type) VALUES (?, ?, ?, ?)', [member.guildId, userId, tax, source]);
  return income - tax;
}

// --- Уровни (чистые функции) ---

export function expForLevel(level: number): number {
  return 10 * Math.pow(2, level - 1);
}

export const STAT_POINTS_PER_LEVEL = 5;

export function applyExp(userId: number, expGain: number, currentExp: number, currentLevel: number, currentStatPoints: number): {
  newExp: number; newLevel: number; levelsGained: number; newStatPoints: number;
} {
  let exp = currentExp + expGain;
  let level = currentLevel;
  let gained = 0;
  while (exp >= expForLevel(level)) {
    exp -= expForLevel(level);
    level++;
    gained++;
  }
  const sp = currentStatPoints + gained * STAT_POINTS_PER_LEVEL;
  return { newExp: exp, newLevel: level, levelsGained: gained, newStatPoints: sp };
}
