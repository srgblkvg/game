"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const stats_1 = require("../game/stats");
const router = (0, express_1.Router)();
// Загрузить персонажа (текущего пользователя)
router.get('/character/me', (req, res) => {
    const userId = req.userId;
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    const inventory = JSON.parse(user.inventory || '[]');
    const equipment = JSON.parse(user.equipment || '{}');
    const getCraftData = database_1.default.prepare('SELECT type, image FROM craft_items WHERE id = ?');
    const enrichedInventory = inventory.map((item) => {
        if (item.type === 'craft_item' || item.type === 'material') {
            // Пробуем найти по id
            const craftRow = getCraftData.get(Number(item.id));
            if (craftRow) {
                return {
                    ...item,
                    itemType: craftRow.type || 'craft',
                    image: craftRow.image || null
                };
            }
            // Если не нашли, ищем по редкости и типу
            const craftByRarity = database_1.default.prepare('SELECT id, type, image FROM craft_items WHERE rarity = ? AND type = ?')
                .get(item.rarity, item.itemType || 'craft');
            if (craftByRarity) {
                return {
                    ...item,
                    id: craftByRarity.id, // обновляем id на правильный
                    itemType: craftByRarity.type || 'craft',
                    image: craftByRarity.image || null
                };
            }
        }
        return item;
    });
    if (JSON.stringify(enrichedInventory) !== JSON.stringify(inventory)) {
        database_1.default.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(enrichedInventory), userId);
    }
    const stats = (0, stats_1.currentStats)({ s: 5 * Math.pow(2, user.level - 1), a: 5 * Math.pow(2, user.level - 1), v: 100, d: 5 * Math.pow(2, user.level - 1), m: 5 * Math.pow(2, user.level - 1) }, equipment);
    // Проверка завершённой работы
    let jobData = null;
    if (user.activeJob) {
        jobData = JSON.parse(user.activeJob);
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= jobData.endTime) {
            const newMoney = user.money + jobData.reward;
            database_1.default.prepare('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?')
                .run(newMoney, userId);
            database_1.default.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, jobData.jobId, jobData.name, jobData.duration, jobData.reward, new Date(jobData.startTime * 1000).toISOString());
            user.money = newMoney;
            user.activeJob = null;
            jobData = null;
        }
    }
    // Регенерация здоровья
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - (user.lastHpUpdate || 0);
    const hpRegen = stats.extra.hpRegen || 0;
    let currentHp = user.currentHp;
    if (elapsed > 0 && hpRegen > 0) {
        currentHp = Math.min(user.currentHp + elapsed * hpRegen, stats.hp);
        database_1.default.prepare('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?')
            .run(currentHp, now, userId);
    }
    const openPrivateTabs = JSON.parse(user.openPrivateTabs || '[]');
    if (user.inventory) {
        let inventory = JSON.parse(user.inventory);
        let changed = false;
        const getCraftType = database_1.default.prepare('SELECT type FROM craft_items WHERE id = ?');
        inventory = inventory.map((item) => {
            if ((item.type === 'craft_item' || item.type === 'material') && (!item.itemType || item.image === undefined)) {
                const craftRow = getCraftType.get(Number(item.id));
                if (craftRow) {
                    changed = true;
                    return { ...item, itemType: craftRow.type || 'craft', image: craftRow.image || null };
                }
            }
            return item;
        });
        if (changed) {
            // обновляем инвентарь в БД, чтобы в следующий раз не обогащать
            database_1.default.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
        }
        user.inventory = JSON.stringify(inventory);
    }
    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        exp: user.exp,
        money: user.money,
        totalBattles: user.totalBattles,
        wins: user.wins,
        inventory,
        equipment,
        baseStats: { s: 5 * Math.pow(2, user.level - 1), a: 5 * Math.pow(2, user.level - 1), v: 100, d: 5 * Math.pow(2, user.level - 1), m: 5 * Math.pow(2, user.level - 1) },
        currentHp,
        stats,
        lastAttackTime: user.lastAttackTime || 0,
        protectionUntil: user.protectionUntil || 0,
        inventorySlots: user.inventorySlots || 10,
        activeJob: jobData,
        role: user.role || 'player',
        openPrivateTabs,
        gender: user.gender || 'male',
    });
});
// Сохранить персонажа (полное обновление)
router.post('/character/save', (req, res) => {
    const userId = req.userId;
    const { inventory, equipment, level, exp, money, totalBattles, wins } = req.body;
    database_1.default.prepare('UPDATE users SET level=?, exp=?, money=?, totalBattles=?, wins=?, inventory=?, equipment=? WHERE id=?')
        .run(level, exp, money, totalBattles, wins, JSON.stringify(inventory), JSON.stringify(equipment), userId);
    res.json({ success: true });
});
// Экипировка/снятие предмета
router.post('/character/equip', (req, res) => {
    const userId = req.userId;
    const { slotId, itemId } = req.body;
    if (!slotId)
        return res.status(400).json({ error: 'slotId required' });
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const inventory = JSON.parse(user.inventory || '[]');
    const equipment = JSON.parse(user.equipment || '{}');
    const currentEquipped = equipment[slotId];
    // Снятие предмета
    if (itemId === undefined || itemId === null) {
        if (!currentEquipped)
            return res.status(400).json({ error: 'Слот пуст' });
        inventory.push(currentEquipped);
        delete equipment[slotId];
        database_1.default.prepare('UPDATE users SET inventory = ?, equipment = ? WHERE id = ?')
            .run(JSON.stringify(inventory), JSON.stringify(equipment), userId);
        const now = Math.floor(Date.now() / 1000);
        database_1.default.prepare('UPDATE users SET lastHpUpdate = ? WHERE id = ?').run(now, userId);
        return res.json({ inventory, equipment });
    }
    // Надевание предмета
    const itemIndex = inventory.findIndex((i) => i.id == itemId);
    if (itemIndex === -1)
        return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    const item = inventory[itemIndex];
    if (!item || item.type === 'material')
        return res.status(400).json({ error: 'Нельзя надеть материал' });
    if (!(0, stats_1.isSlotCompatible)(slotId, item))
        return res.status(400).json({ error: 'Предмет не подходит к слоту' });
    if (item.name?.includes('двуручн') && slotId !== 'weapon1') {
        return res.status(400).json({ error: 'Двуручное оружие можно надеть только в первый слот' });
    }
    if ((slotId === 'ring1' || slotId === 'ring2') && item.slot?.startsWith('ring')) {
        const otherSlot = slotId === 'ring1' ? 'ring2' : 'ring1';
        const otherItem = equipment[otherSlot];
        if (otherItem && otherItem.name === item.name) {
            return res.status(400).json({ error: 'Нельзя надеть два одинаковых кольца' });
        }
    }
    if (item.name?.includes('двуручн') && slotId === 'weapon1' && equipment['weapon2']) {
        inventory.push(equipment['weapon2']);
        delete equipment['weapon2'];
    }
    if (currentEquipped) {
        inventory.push(currentEquipped);
    }
    inventory.splice(itemIndex, 1);
    equipment[slotId] = item;
    database_1.default.prepare('UPDATE users SET inventory = ?, equipment = ? WHERE id = ?')
        .run(JSON.stringify(inventory), JSON.stringify(equipment), userId);
    const now = Math.floor(Date.now() / 1000);
    database_1.default.prepare('UPDATE users SET lastHpUpdate = ? WHERE id = ?').run(now, userId);
    res.json({ inventory, equipment });
});
// Разобрать предмет(ы)
router.post('/character/salvage', (req, res) => {
    const userId = req.userId;
    const { itemIds } = req.body;
    if (!itemIds)
        return res.status(400).json({ error: 'itemIds required' });
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    let inventory = JSON.parse(user.inventory || '[]');
    const idsToDelete = new Set(itemIds.map((id) => String(id)));
    // Собираем редкости разбираемых предметов
    const materialsToAdd = [];
    inventory = inventory.filter((item) => {
        const itemIdStr = String(item.id);
        if (idsToDelete.has(itemIdStr) && item.type !== 'craft_item') {
            const rarity = item.rarity || 0;
            const existing = materialsToAdd.find(m => m.rarity === rarity);
            if (existing)
                existing.count += 1;
            else
                materialsToAdd.push({ rarity, count: 1 });
            return false;
        }
        return true;
    });
    // Для каждого полученного материала находим craft_item и добавляем в инвентарь
    const getCraftItemByRarity = database_1.default.prepare('SELECT id, name, rarity, type, image FROM craft_items WHERE rarity = ?');
    for (const mat of materialsToAdd) {
        const craftItem = getCraftItemByRarity.get(mat.rarity);
        if (!craftItem)
            continue;
        const existingCraft = inventory.find((i) => i.type === 'craft_item' && i.id === craftItem.id);
        if (existingCraft) {
            existingCraft.count += mat.count;
        }
        else {
            inventory.push({
                type: 'craft_item',
                id: craftItem.id,
                name: craftItem.name,
                rarity: craftItem.rarity,
                count: mat.count,
                itemType: craftItem.type || 'craft',
                image: craftItem.image || null,
            });
        }
    }
    database_1.default.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
    res.json({ success: true, inventory });
});
// Расширить инвентарь
router.post('/character/expand-inventory', (req, res) => {
    const userId = req.userId;
    const user = database_1.default.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const currentSlots = user.inventorySlots || 10;
    const price = 100 * Math.pow(2, currentSlots - 10);
    if (user.money < price)
        return res.status(400).json({ error: 'Недостаточно монет' });
    database_1.default.prepare('UPDATE users SET money = money - ?, inventorySlots = inventorySlots + 1 WHERE id = ?')
        .run(price, userId);
    res.json({ inventorySlots: currentSlots + 1, moneyAfter: user.money - price });
});
// Поиск пользователя по нику (для чата)
router.get('/users/find', (req, res) => {
    let username = req.query.username;
    if (!username)
        return res.status(400).json({ error: 'username required' });
    if (username.startsWith('@')) {
        username = username.slice(1);
    }
    const user = database_1.default.prepare('SELECT id, username, level FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});
// GET /users/list?ids=1,2,3
router.get('/users/list', (req, res) => {
    const idsParam = req.query.ids;
    if (!idsParam)
        return res.json([]);
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0)
        return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const users = database_1.default.prepare(`SELECT id, username FROM users WHERE id IN (${placeholders})`).all(...ids);
    res.json(users);
});
// Публичный профиль игрока
router.get('/character/public/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = database_1.default.prepare('SELECT id, username, level, totalBattles, wins, equipment, currentHp, gender FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const equipment = JSON.parse(user.equipment || '{}');
    const stats = (0, stats_1.currentStats)({ s: 5 * Math.pow(2, user.level - 1), a: 5 * Math.pow(2, user.level - 1), v: 100, d: 5 * Math.pow(2, user.level - 1), m: 5 * Math.pow(2, user.level - 1) }, equipment);
    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        totalBattles: user.totalBattles,
        wins: user.wins,
        equipment,
        stats,
        currentHp: user.currentHp,
        gender: user.gender || 'male',
    });
});
// Рейтинг игроков (по победам)
router.get('/rating', (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const total = database_1.default.prepare('SELECT COUNT(*) as cnt FROM users').get().cnt;
    const users = database_1.default.prepare(`
    SELECT id, username, level, wins
    FROM users
    ORDER BY wins DESC, level DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);
    res.json({ users, total });
});
// Сохранение открытых вкладок приватного чата
router.post('/character/save-tabs', (req, res) => {
    const userId = req.userId;
    const { tabs } = req.body; // массив ID пользователей
    if (!Array.isArray(tabs))
        return res.status(400).json({ error: 'tabs должен быть массивом' });
    database_1.default.prepare('UPDATE users SET openPrivateTabs = ? WHERE id = ?').run(JSON.stringify(tabs), userId);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=character.js.map