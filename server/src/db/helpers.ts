import { db } from '../db/index';
import { StatRecord, sumStats } from '../game/stats';

// ── Общие поля пользователя для боевых запросов ──
// ЕДИНСТВЕННОЕ место правки при добавлении поля в users

/** Поля для PvP боя (attacker/defender/arena opponent) */
export const USER_BATTLE_FIELDS = `
  u.id, u.username, u.level, u.exp, u.elo, u.seasonWins, u.seasonLosses,
  u.baseS, u.baseA, u.baseD, u.baseM,
  u.equipment, u.money, u.currentHp, u.lastAttackTime,
  u.activeDrink, u.drinkUntil, u.premiumUntil,
  u.protectionUntil, u.roomType, u.roomUntil, u.lastHpUpdate,
  u.inventorySlots, u.guildId, u.oauthProvider, u.oauthId, u.faction, u.bandit_reputation
`;

/** Поля с присоединением гильдии */
export const USER_BATTLE_FIELDS_GUILD = `
  ${USER_BATTLE_FIELDS}, g.name as guildName
`;

/** Поля для арены (добавляет arenaOpponentId, убирает exp и лишнее) */
export const USER_ARENA_FIELDS_GUILD = `
  u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses,
  u.equipment, u.baseS, u.baseA, u.baseD, u.baseM, u.money,
  u.currentHp, u.lastHpUpdate, u.roomType, u.roomUntil, u.premiumUntil,
  u.inventorySlots, u.lastAttackTime, u.arenaOpponentId,
  u.activeDrink, u.drinkUntil, u.guildId,
  u.gender, u.avatar, u.faction, g.name as guildName
`;

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

export function getBaseStats(user: any): StatRecord {
  return {
    s: user.baseS ?? 5,
    a: user.baseA ?? 5,
    d: user.baseD ?? 5,
    m: user.baseM ?? 5,
  };
}

export function getMaxHp(stats: { hp?: number } & StatRecord) {
  return stats.hp ?? sumStats(stats);
}

// --- Экипировка ---

export function parseEquipment(eq?: string | null): Record<string, any> {
    try { return eq ? JSON.parse(eq) : {}; }
    catch { return {}; }
}

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
  await db.run('INSERT INTO guild_treasury_log (guildId, userId, amount, type, createdat) VALUES (?, ?, ?, ?, ?)', [member.guildId, userId, tax, source, new Date().toISOString()]);
  // Guild quest progress — налог тоже считается взносом в казну
  import('../routes/guild/guildQuests').then(m => m.updateGuildQuestProgress(member.guildId, 'donate', tax)).catch(() => {});
  return income - tax;
}

// --- Статы персонажа (хелпер для всех роутов) ---

import { getDrinkBonuses } from '../game/drinks';
import { getGuildBonus } from '../game/guildBuildings';
import { currentStats, CharStats } from '../game/stats';

type BattleContext = 'arena' | 'tournament' | 'pve' | 'war_attack' | 'war_defense';

/** Собрать полные статы игрока со ВСЕМИ бонусами — ЕДИНСТВЕННОЕ место */
export async function buildPlayerStats(userRow: any, context: BattleContext): Promise<CharStats> {
  const base = getBaseStats(userRow);
  // Читаем экипировку из активного слота (equipment_1/2/3), фолбэк на старый equipment
  const parseEq = (v: any) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
  const equip = parseEq(userRow.equipment_1) || parseEq(userRow.equipment);
  const drinks = getDrinkBonuses(userRow);
  const r = await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userRow.id]);
  const collCnt = r?.cnt || 0;
  
  // Бонус за полностью собранные сеты коллекции
  const completedSetBonus = await db.one(`
    SELECT COALESCE(SUM(cs.bonus_percent), 0) as total
    FROM collection_sets cs
    WHERE cs.id IN (
      SELECT si.set_id
      FROM collection_set_items si
      LEFT JOIN collections c ON c.userId = ? AND c.itemName = si.item_name AND c.slot = si.slot AND c.rarity_id = si.rarity_id
      GROUP BY si.set_id
      HAVING COUNT(*) = COUNT(c.id)
    )
  `, [userRow.id]) as any;
  
  const totalCollBonus = collCnt + (completedSetBonus?.total || 0);
  const gb = await getGuildBonus(userRow.id, context);
  return currentStats(base, equip, drinks, totalCollBonus, gb);
}

/** Быстрый расчёт полного бонуса коллекции (предметы + сеты) для одного userId */
export async function getCollectionBonus(userId: number): Promise<number> {
  const r = await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]) as any;
  const collCnt = r?.cnt || 0;
  const completedSetBonus = await db.one(`
    SELECT COALESCE(SUM(cs.bonus_percent), 0) as total
    FROM collection_sets cs
    WHERE cs.id IN (
      SELECT si.set_id
      FROM collection_set_items si
      LEFT JOIN collections c ON c.userId = ? AND c.itemName = si.item_name AND c.slot = si.slot AND c.rarity_id = si.rarity_id
      GROUP BY si.set_id
      HAVING COUNT(*) = COUNT(c.id)
    )
  `, [userId]) as any;
  return collCnt + (completedSetBonus?.total || 0);
}

// --- Стартовая экипировка для новых игроков ---

/**
 * Возвращает JSON-строку для колонки equipment_1 с базовым хлам-шмотом.
 * Все предметы rarity 0 (Хлам), upgradeLevel 0.
 */
export function getStarterEquipment(): string {
  const now = Date.now();
  const items: Record<string, any> = {
    weapon1: {
      id: now + 1,
      name: 'Стон могильщика',
      slot: 'weapon1',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 2, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
      upgradeLevel: 0,
      image: 'sword/sword_gray.webp',
    },
    shield: {
      id: now + 2,
      name: 'Гробовая преграда',
      slot: 'shield',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 0, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 },
      upgradeLevel: 0,
      image: 'shield/shield_gray.webp',
    },
    helmet: {
      id: now + 3,
      name: 'Скорбный капюшон',
      slot: 'helmet',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 1, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
      upgradeLevel: 0,
      image: 'helmet/helmet_gray.webp',
    },
    chest: {
      id: now + 4,
      name: 'Скорлупный доспех',
      slot: 'chest',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 0, a: 0, d: 1, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
      upgradeLevel: 0,
      image: 'chest/chest_gray.webp',
    },
    gloves: {
      id: now + 5,
      name: 'Костяшковые захваты',
      slot: 'gloves',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 0, a: 1, d: 0, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
      upgradeLevel: 0,
      image: 'gloves/gloves_gray.webp',
    },
    boots: {
      id: now + 6,
      name: 'Могильные башмаки',
      slot: 'boots',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 0, a: 0, d: 1, m: 0 },
      extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 },
      upgradeLevel: 0,
      image: 'boots/boots_gray.webp',
    },
    belt: {
      id: now + 7,
      name: 'Кожаная перевязь',
      slot: 'belt',
      rarity_id: 0,
      rarity_display: 'Хлам',
      rarity_color: '#888888',
      bonuses: { s: 0, a: 0, d: 0, m: 0 },
      extra: { crit: 0, dodge: 1, counter: 0, fullBlock: 0 },
      upgradeLevel: 0,
      image: 'belt/belt_gray.webp',
    },
  };
  return JSON.stringify(items);
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
  // Достижение за уровень — отслеживаем текущий уровень, не инкремент
  if (gained > 0) {
    import('../routes/achievements').then(m => m.setAchievementProgress(userId, 'level', level)).catch(() => {});
  }
  return { newExp: exp, newLevel: level, levelsGained: gained, newStatPoints: sp };
}
