"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAT_POINTS_PER_LEVEL = exports.USER_ARENA_FIELDS_GUILD = exports.USER_BATTLE_FIELDS_GUILD = exports.USER_BATTLE_FIELDS = void 0;
exports.getUserById = getUserById;
exports.getUserWithStats = getUserWithStats;
exports.getBaseStats = getBaseStats;
exports.getMaxHp = getMaxHp;
exports.parseEquipment = parseEquipment;
exports.enrichEquipment = enrichEquipment;
exports.recalcHpOnEquip = recalcHpOnEquip;
exports.transferMoney = transferMoney;
exports.addMoney = addMoney;
exports.spendMoney = spendMoney;
exports.collectGuildTax = collectGuildTax;
exports.buildPlayerStats = buildPlayerStats;
exports.getCollectionBonus = getCollectionBonus;
exports.getStarterEquipment = getStarterEquipment;
exports.expForLevel = expForLevel;
exports.applyExp = applyExp;
const index_1 = require("../db/index");
const stats_1 = require("../game/stats");
// ── Общие поля пользователя для боевых запросов ──
// ЕДИНСТВЕННОЕ место правки при добавлении поля в users
/** Поля для PvP боя (attacker/defender/arena opponent) */
exports.USER_BATTLE_FIELDS = `
  u.id, u.username, u.level, u.exp, u.elo, u.seasonWins, u.seasonLosses,
  u.baseS, u.baseA, u.baseD, u.baseM,
  u.equipment, u.equipment_1, u.equipment_2, u.equipment_3, u.active_equip_slot,
  u.money, u.currentHp, u.lastAttackTime,
  u.activeDrink, u.drinkUntil, u.premiumUntil,
  u.protectionUntil, u.roomType, u.roomUntil, u.lastHpUpdate,
  u.inventorySlots, u.guildId, u.oauthProvider, u.oauthId, u.faction, u.bandit_reputation, u.tutorial_step, u.tutorial_completed
`;
/** Поля с присоединением гильдии */
exports.USER_BATTLE_FIELDS_GUILD = `
  ${exports.USER_BATTLE_FIELDS}, g.name as guildName
`;
/** Поля для арены (добавляет arenaOpponentId, убирает exp и лишнее) */
exports.USER_ARENA_FIELDS_GUILD = `
  u.id, u.username, u.level, u.elo, u.seasonWins, u.seasonLosses,
  u.equipment, u.equipment_1, u.equipment_2, u.equipment_3, u.active_equip_slot,
  u.baseS, u.baseA, u.baseD, u.baseM, u.money,
  u.currentHp, u.lastHpUpdate, u.roomType, u.roomUntil, u.premiumUntil,
  u.inventorySlots, u.lastAttackTime, u.arenaOpponentId,
  u.activeDrink, u.drinkUntil, u.guildId,
  u.gender, u.avatar, u.faction, g.name as guildName
`;
// --- Подготовленные запросы (ленивая инициализация) ---
let _getItemSQL;
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
async function getUserById(userId) {
    return index_1.db.one('SELECT u.*, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?', [userId]);
}
async function getUserWithStats(userId) {
    return index_1.db.one('SELECT u.id, u.username, u.level, u.money, u.exp, u.totalBattles, u.wins, u.inventory, u.equipment, u.currentHp, u.lastHpUpdate, u.lastAttackTime, u.protectionUntil, u.inventorySlots, u.activeJob, u.chatBannedUntil, u.openPrivateTabs, u.gender, u.statPoints, u.baseS, u.baseA, u.baseD, u.baseM, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?', [userId]);
}
// --- Статы (чистые функции) ---
function getBaseStats(user) {
    return {
        s: user.baseS ?? 5,
        a: user.baseA ?? 5,
        d: user.baseD ?? 5,
        m: user.baseM ?? 5,
    };
}
function getMaxHp(stats) {
    return stats.hp ?? (0, stats_1.sumStats)(stats);
}
// --- Экипировка ---
function parseEquipment(eq) {
    try {
        return eq ? JSON.parse(eq) : {};
    }
    catch {
        return {};
    }
}
async function enrichEquipment(equipment) {
    const sql = getItemSQL();
    let changed = false;
    const enriched = {};
    for (const [slotId, item] of Object.entries(equipment)) {
        if (item && item.slot && item.rarity_id === undefined) {
            const row = await index_1.db.one(sql, [item.name, item.slot]);
            if (row) {
                changed = true;
                enriched[slotId] = {
                    ...item,
                    rarity_id: row.rarity_id,
                    rarity_display: row.rarity_display,
                    rarity_color: row.rarity_color,
                    image: row.image || item.image || null,
                };
            }
            else {
                enriched[slotId] = item;
            }
        }
        else {
            enriched[slotId] = item;
        }
    }
    return { enriched, changed };
}
// --- HP (чистая функция) ---
function recalcHpOnEquip(currentHp, oldMaxHp, newMaxHp) {
    return Math.max(1, Math.floor(currentHp * newMaxHp / (oldMaxHp || 1)));
}
// --- Деньги ---
async function transferMoney(fromUserId, toUserId, amount) {
    const result = await index_1.db.run('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?', [amount, fromUserId, amount]);
    if (result.changes === 0)
        return false;
    await index_1.db.run('UPDATE users SET money = money + ? WHERE id = ?', [amount, toUserId]);
    return true;
}
async function addMoney(userId, amount) {
    await index_1.db.run('UPDATE users SET money = money + ? WHERE id = ?', [amount, userId]);
}
async function spendMoney(userId, amount) {
    const result = await index_1.db.run('UPDATE users SET money = money - ? WHERE id = ? AND money >= ?', [amount, userId, amount]);
    return result.changes > 0;
}
// --- Налог гильдии ---
async function collectGuildTax(userId, income, source) {
    if (income <= 0)
        return income;
    const member = await index_1.db.one('SELECT gm.guildId, g.taxRate FROM guild_members gm JOIN guilds g ON gm.guildId = g.id WHERE gm.userId = ?', [userId]);
    if (!member || !member.taxRate || member.taxRate <= 0)
        return income;
    const tax = Math.max(1, Math.floor(income * member.taxRate / 100));
    if (tax <= 0)
        return income;
    await index_1.db.run('UPDATE guilds SET treasury = treasury + ? WHERE id = ?', [tax, member.guildId]);
    await index_1.db.run('INSERT INTO guild_treasury_log (guildId, userId, amount, type, createdat) VALUES (?, ?, ?, ?, ?)', [member.guildId, userId, tax, source, new Date().toISOString()]);
    // Guild quest progress — налог тоже считается взносом в казну
    Promise.resolve().then(() => __importStar(require('../routes/guild/guildQuests'))).then(m => m.updateGuildQuestProgress(member.guildId, 'donate', tax)).catch(() => { });
    return income - tax;
}
// --- Статы персонажа (хелпер для всех роутов) ---
const drinks_1 = require("../game/drinks");
const guildBuildings_1 = require("../game/guildBuildings");
const stats_2 = require("../game/stats");
/** Собрать полные статы игрока со ВСЕМИ бонусами — ЕДИНСТВЕННОЕ место */
async function buildPlayerStats(userRow, context) {
    const base = getBaseStats(userRow);
    // Читаем экипировку из активного слота (equipment_1/2/3), фолбэк на старый equipment
    const parseEq = (v) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    const activeSlot = userRow.active_equip_slot || 1;
    const equipKey = `equipment_${activeSlot}`;
    let equip = parseEq(userRow[equipKey]);
    if (Object.keys(equip).length === 0)
        equip = parseEq(userRow.equipment);
    const drinks = (0, drinks_1.getDrinkBonuses)(userRow);
    const r = await index_1.db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userRow.id]);
    const collCnt = r?.cnt || 0;
    // Бонус за полностью собранные сеты коллекции
    const completedSetBonus = await index_1.db.one(`
    SELECT COALESCE(SUM(cs.bonus_percent), 0) as total
    FROM collection_sets cs
    WHERE cs.id IN (
      SELECT si.set_id
      FROM collection_set_items si
      LEFT JOIN collections c ON c.userId = ? AND c.itemName = si.item_name AND c.slot = si.slot AND c.rarity_id = si.rarity_id
      GROUP BY si.set_id
      HAVING COUNT(*) = COUNT(c.id)
    )
  `, [userRow.id]);
    const totalCollBonus = collCnt + (completedSetBonus?.total || 0);
    const gb = await (0, guildBuildings_1.getGuildBonus)(userRow.id, context);
    return (0, stats_2.currentStats)(base, equip, drinks, totalCollBonus, gb);
}
/** Быстрый расчёт полного бонуса коллекции (предметы + сеты) для одного userId */
async function getCollectionBonus(userId) {
    const r = await index_1.db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]);
    const collCnt = r?.cnt || 0;
    const completedSetBonus = await index_1.db.one(`
    SELECT COALESCE(SUM(cs.bonus_percent), 0) as total
    FROM collection_sets cs
    WHERE cs.id IN (
      SELECT si.set_id
      FROM collection_set_items si
      LEFT JOIN collections c ON c.userId = ? AND c.itemName = si.item_name AND c.slot = si.slot AND c.rarity_id = si.rarity_id
      GROUP BY si.set_id
      HAVING COUNT(*) = COUNT(c.id)
    )
  `, [userId]);
    return collCnt + (completedSetBonus?.total || 0);
}
// --- Стартовая экипировка для новых игроков ---
/**
 * Возвращает JSON-строку для колонки equipment_1 с базовым хлам-шмотом.
 * Все предметы rarity 0 (Хлам), upgradeLevel 0.
 */
function getStarterEquipment() {
    const now = Date.now();
    const items = {
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
function expForLevel(level) {
    return 10 * Math.pow(2, level - 1);
}
exports.STAT_POINTS_PER_LEVEL = 5;
function applyExp(userId, expGain, currentExp, currentLevel, currentStatPoints) {
    let exp = currentExp + expGain;
    let level = currentLevel;
    let gained = 0;
    while (exp >= expForLevel(level)) {
        exp -= expForLevel(level);
        level++;
        gained++;
    }
    const sp = currentStatPoints + gained * exports.STAT_POINTS_PER_LEVEL;
    // Достижение за уровень — отслеживаем текущий уровень, не инкремент
    if (gained > 0) {
        Promise.resolve().then(() => __importStar(require('../routes/achievements'))).then(m => m.setAchievementProgress(userId, 'level', level)).catch(() => { });
    }
    return { newExp: exp, newLevel: level, levelsGained: gained, newStatPoints: sp };
}
//# sourceMappingURL=helpers.js.map