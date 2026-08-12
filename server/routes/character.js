"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const helpers_1 = require("../db/helpers");
const vkLeaderboard_1 = require("../vkLeaderboard");
const drinks_1 = require("../game/drinks");
const hpRegen_1 = require("../game/hpRegen");
const guild_1 = require("./guild");
const guildBuildings_1 = require("../game/guildBuildings");
const events_1 = require("../events");
const router = (0, express_1.Router)();
const ITEM_DATA_SQL = `
    SELECT i.rarity_id, i.image, r.display_name as rarity_display, r.color as rarity_color
    FROM items i JOIN rarities r ON i.rarity_id = r.id
    WHERE i.name = ? AND i.slot = ?
`;
const CRAFT_DATA_SQL = `
    SELECT c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color
    FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
    WHERE c.id = ?
`;
// Загрузить персонажа (текущего пользователя)
router.get('/character/me', async (req, res) => {
    const userId = req.userId;
    const user = await (0, helpers_1.getUserById)(userId);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    let inventory = JSON.parse(user.inventory || '[]');
    const activeSlot = user.active_equip_slot || 1;
    const equipKey = `equipment_${activeSlot}`;
    const parseEq = (v) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    const rawEq = parseEq(user[equipKey]);
    const equipment = Object.keys(rawEq).length > 0 ? rawEq : parseEq(user.equipment);
    const equipment1 = parseEq(user.equipment_1);
    const equipment2 = parseEq(user.equipment_2);
    const equipment3 = parseEq(user.equipment_3);
    let changed = false;
    // Собираем уникальные ID крафт-предметов и загружаем данные одним запросом
    const craftIds = [...new Set(inventory.filter((i) => i.type === 'craft_item' || i.type === 'material').map((i) => Number(i.id)))];
    const craftDataMap = {};
    if (craftIds.length > 0) {
        const craftRows = await index_1.db.query(`SELECT c.id, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color
         FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
         WHERE c.id IN (${craftIds.join(',')})`, []);
        for (const row of craftRows)
            craftDataMap[row.id] = row;
    }
    // Обогащаем инвентарь: крафт-предметы из кеша, шмот через БД
    inventory = await Promise.all(inventory.map(async (item) => {
        if ((item.type === 'craft_item' || item.type === 'material')) {
            const craftRow = craftDataMap[Number(item.id)];
            if (craftRow) {
                const needsUpdate = item.rarity_id === undefined || !item.image
                    || item.rarity_display !== craftRow.rarity_display
                    || item.rarity_color !== craftRow.rarity_color;
                if (needsUpdate) {
                    changed = true;
                    return {
                        ...item,
                        rarity_id: item.rarity_id ?? craftRow.rarity_id,
                        rarity_display: craftRow.rarity_display,
                        rarity_color: craftRow.rarity_color,
                        itemType: item.itemType || craftRow.type || 'craft',
                        image: craftRow.image || item.image || null,
                    };
                }
            }
        }
        else if (item.slot) {
            if (item.rarity_id === undefined || !item.image) {
                const itemRow = await index_1.db.one(ITEM_DATA_SQL, [item.name, item.slot]);
                if (itemRow) {
                    changed = true;
                    return {
                        ...item,
                        rarity_id: itemRow.rarity_id,
                        rarity_display: itemRow.rarity_display,
                        rarity_color: itemRow.rarity_color,
                        image: itemRow.image || item.image || null,
                    };
                }
            }
        }
        return item;
    }));
    // Обогащаем экипировку
    const { enriched: enrichedEquipment, changed: equipChanged } = await (0, helpers_1.enrichEquipment)(equipment);
    if (changed) {
        await index_1.db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    }
    if (equipChanged) {
        await index_1.db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(enrichedEquipment), userId]);
    }
    const drinkBonuses = (0, drinks_1.getDrinkBonuses)(user);
    const collectionCount = (await index_1.db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId])).cnt;
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
    `, [userId]);
    const totalCollectionBonus = (collectionCount || 0) + (completedSetBonus?.total || 0);
    const collectedItems = await index_1.db.query('SELECT itemName, slot, rarity_id, upgradelevel FROM collections WHERE userId = ?', [userId]);
    const guildBonus = await (0, guildBuildings_1.getGuildBonus)(userId, 'arena');
    const buildings = await (0, guildBuildings_1.getGuildBuildings)(userId);
    const stats = await (0, helpers_1.buildPlayerStats)(user, 'arena');
    const totalCollectionItems = ((await index_1.db.one('SELECT COUNT(*) as cnt FROM collection_set_items')).cnt || 225) * 2;
    let jobData = null;
    if (user.activeJob) {
        jobData = JSON.parse(user.activeJob);
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= jobData.endTime) {
            // Налог гильдии (работы)
            const rewardAfterTax = await (0, helpers_1.collectGuildTax)(userId, jobData.reward, 'tax_job');
            const newMoney = user.money + rewardAfterTax;
            const expGain = jobData.expReward || 0;
            const { newExp, newLevel, levelsGained, newStatPoints } = await (0, helpers_1.applyExp)(userId, expGain, user.exp, user.level, user.statPoints || 0);
            await index_1.db.run('UPDATE users SET money = ?, exp = ?, level = ?, statPoints = ?, activeJob = NULL, totalJobMoney = totalJobMoney + ?, totalJobSeconds = totalJobSeconds + ? WHERE id = ?', [newMoney, newExp, newLevel, newStatPoints, jobData.reward, jobData.duration, userId]);
            await index_1.db.run('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt, premiumBonus, xpGained) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [userId, jobData.jobId, jobData.name, jobData.duration, jobData.reward, new Date(jobData.startTime * 1000).toISOString(), jobData.premiumBonus || 0, expGain]);
            if (levelsGained > 0 && user.oauthProvider === 'vk' && user.oauthId) {
                (0, vkLeaderboard_1.sendLeaderboardLevel)(userId, newLevel, String(user.oauthId)).catch(() => { });
            }
            // Guild quest progress — track job seconds
            if (user.guildId) {
                (0, guild_1.updateGuildQuestProgress)(user.guildId, 'jobs', jobData.duration).catch(e => console.error('guildQuest jobs:', e.message));
            }
            // Daily quests — track job seconds
            (0, events_1.markDirty)(userId, 'quests');
            user.money = newMoney;
            user.level = newLevel;
            user.statPoints = newStatPoints;
            user.activeJob = null;
            jobData = null;
        }
    }
    const now = Math.floor(Date.now() / 1000);
    const maxHp = stats.hp;
    const hpRegenParams = {
        id: user.id,
        currentHp: user.currentHp,
        maxHp,
        lastHpUpdate: user.lastHpUpdate || 0,
        roomType: user.roomType,
        roomUntil: user.roomUntil,
        premiumUntil: user.premiumUntil,
    };
    if (stats.hermitRegen)
        hpRegenParams.hermitRegen = true;
    let currentHp = await (0, hpRegen_1.applyHpRegen)(hpRegenParams);
    // Если currentHp > maxHp (например после изменения бонусов) — ограничиваем
    if (currentHp > maxHp) {
        currentHp = maxHp;
        await index_1.db.run('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?', [maxHp, now, userId]);
    }
    const openPrivateTabs = JSON.parse(user.openPrivateTabs || '[]');
    res.json({
        id: user.id, username: user.username, level: user.level,
        guildName: user.guildName || null,
        avatar: user.avatar || null,
        exp: user.exp, money: user.money, totalBattles: user.totalBattles,
        wins: user.wins, inventory, equipment: enrichedEquipment,
        baseStats: { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 },
        currentHp, stats, lastAttackTime: user.lastAttackTime || 0,
        protectionUntil: user.protectionUntil || 0,
        lastHpUpdate: now, // регенерация уже применена сервером до now
        lastPveAttackTime: user.lastPveAttackTime || 0,
        pvpCdSec: ((user.premiumUntil || 0) > now ? 300 : 600) / (user.faction === 'bandit' ? 2 : 1),
        pveCdSec: (user.premiumUntil || 0) > now ? 150 : 300,
        attackCooldownSec: Math.max(0, ((user.premiumUntil || 0) > now ? 300 : 600) / (user.faction === 'bandit' ? 2 : 1) - (now - (user.lastAttackTime || 0))),
        pveCooldownSec: Math.max(0, ((user.premiumUntil || 0) > now ? 150 : 300) - (now - (user.lastPveAttackTime || 0))),
        inventorySlots: user.inventorySlots || 10,
        activeJob: jobData, role: user.role || 'player',
        bank: user.bank || 0,
        guildId: user.guildId || null,
        lastBankVisit: user.lastBankVisit || 0,
        faction: user.faction || null,
        karma: user.karma || 0,
        factionCraftCount: user.faction_craft_count || 0,
        banditReputation: user.bandit_reputation || 0,
        room: user.roomType && user.roomUntil > now ? { type: user.roomType, until: user.roomUntil } : null,
        drink: user.activeDrink && user.drinkUntil > now ? { type: user.activeDrink, until: user.drinkUntil } : null,
        premium: user.premiumUntil > now ? { until: user.premiumUntil } : null,
        drinkBonuses,
        openPrivateTabs, gender: user.gender || 'male',
        statPoints: user.statPoints || 0,
        collectionCount: totalCollectionBonus,
        collectionSetBonus: completedSetBonus?.total || 0,
        collectedItems: collectedItems || [],
        guildBonus,
        buildings,
        totalCollectionItems: totalCollectionItems || 189,
        tutorialCompleted: user.tutorialCompleted || 0,
        tutorialStep: user.tutorialStep || 0,
        totalIncome: user.totalIncome || 0,
        overflowmoney: user.overflowmoney || 0,
        adPremiumAt: user.adpremiumat || 0,
        adSilverAt: user.adsilverat || 0,
        equipment1, equipment2, equipment3,
        activeEquipSlot: activeSlot,
    });
});
// Сохранить персонажа (полное обновление)
router.post('/character/save', async (req, res) => {
    const userId = req.userId;
    const { inventory, equipment, level, exp, money, totalBattles, wins } = req.body;
    await index_1.db.run('UPDATE users SET level=?, exp=?, money=?, totalBattles=?, wins=?, inventory=?, equipment=? WHERE id=?', [level, exp, money, totalBattles, wins, JSON.stringify(inventory), JSON.stringify(equipment), userId]);
    res.json({ success: true });
});
// Сохранение открытых вкладок приватного чата
router.post('/character/save-tabs', async (req, res) => {
    const userId = req.userId;
    const { tabs } = req.body;
    if (!Array.isArray(tabs))
        return res.status(400).json({ error: 'tabs должен быть массивом' });
    await index_1.db.run('UPDATE users SET openPrivateTabs = ? WHERE id = ?', [JSON.stringify(tabs), userId]);
    res.json({ success: true });
});
// Отметить туториал как пройденный
router.post('/character/tutorial-done', async (req, res) => {
    const userId = req.userId;
    await index_1.db.run('UPDATE users SET tutorial_completed = 1 WHERE id = ?', [userId]);
    res.json({ success: true });
});
// Продвинуть туториал на один шаг вперёд (клиентская кнопка «Далее»)
router.post('/character/tutorial-step', async (req, res) => {
    const userId = req.userId;
    await index_1.db.run('UPDATE users SET tutorial_step = tutorial_step + 1 WHERE id = ?', [userId]);
    // Если дошли до шага 4 — завершаем
    const user = await index_1.db.one('SELECT tutorial_step FROM users WHERE id = ?', [userId]);
    if ((user?.tutorial_step || 0) >= 4) {
        await index_1.db.run('UPDATE users SET tutorial_completed = 1 WHERE id = ?', [userId]);
    }
    res.json({ success: true, step: user?.tutorial_step || 0 });
});
// Поиск пользователя по нику (для перехода из чата в профиль)
router.get('/users/find', async (req, res) => {
    const username = req.query.username;
    if (!username)
        return res.status(400).json({ error: 'Укажите username' });
    const user = await index_1.db.one('SELECT id, username FROM users WHERE username = ?', [username]);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});
// Поиск пользователей по части имени
router.get('/users/search', async (req, res) => {
    const q = req.query.q;
    if (!q || q.length < 2)
        return res.json([]);
    const users = await index_1.db.query('SELECT id, username, level FROM users WHERE username LIKE ? AND id > 0 LIMIT 10', [`%${q}%`]);
    res.json(users);
});
// Премиум за рекламу (VK) — 1 час, раз в час
router.post('/premium/ad', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT premiumUntil, adpremiumat FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const now = Math.floor(Date.now() / 1000);
    const cooldownSec = 3600; // 1 час
    if (now - (user.adpremiumat || 0) < cooldownSec) {
        const remaining = cooldownSec - (now - user.adpremiumat);
        return res.status(400).json({ error: `Реклама будет доступна через ${Math.ceil(remaining / 60)} мин.` });
    }
    const currentUntil = Math.max(user.premiumUntil || 0, now);
    const newUntil = currentUntil + 3600; // +1 час
    await index_1.db.run('UPDATE users SET premiumUntil = ?, adpremiumat = ? WHERE id = ?', [newUntil, now, userId]);
    res.json({ success: true, premiumUntil: newUntil, message: 'Премиум активирован на 1 час!' });
});
// Серебро за рекламу (VK) — 1000, раз в 30 минут
router.post('/shop/ad-silver', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT money, adsilverat FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const now = Math.floor(Date.now() / 1000);
    const cooldownSec = 300; // 5 минут
    if (now - (user.adsilverat || 0) < cooldownSec) {
        const remaining = cooldownSec - (now - user.adsilverat);
        return res.status(400).json({ error: `Реклама будет доступна через ${Math.ceil(remaining / 60)} мин.` });
    }
    const reward = 1000;
    await index_1.db.run('UPDATE users SET money = money + ?, adsilverat = ? WHERE id = ?', [reward, now, userId]);
    res.json({ success: true, reward, message: `Получено ${reward} серебра за рекламу!` });
});
// Переключение активного слота экипировки (I/II/III)
// Сохраняет текущий equipment в старый слот, загружает новый
router.post('/character/switch-equip', async (req, res) => {
    const userId = req.userId;
    const { slot } = req.body; // 1, 2 или 3
    if (![1, 2, 3].includes(slot))
        return res.status(400).json({ error: 'Неверный слот' });
    const user = await index_1.db.one('SELECT equipment, equipment_1, equipment_2, equipment_3, active_equip_slot FROM users WHERE id = ?', [userId]);
    const oldSlot = user.active_equip_slot || 1;
    if (oldSlot === slot)
        return res.json({ success: true, activeEquipSlot: slot });
    const parseEq = (v) => typeof v === 'string' ? v : JSON.stringify(v);
    const parseEqObj = (v) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    const currentEquip = parseEq(user.equipment);
    const targetEquip = parseEq(user[`equipment_${slot}`]);
    // Сохраняем текущий equipment в старый слот, загружаем новый в equipment
    await index_1.db.run(`UPDATE users SET equipment_${oldSlot} = ?::jsonb, equipment = ?, active_equip_slot = ? WHERE id = ?`, [currentEquip, targetEquip, slot, userId]);
    res.json({ success: true, activeEquipSlot: slot, equipment: parseEqObj(targetEquip) });
});
// Сохранить экипировку в конкретный слот (без переключения)
router.post('/character/save-equip-set', async (req, res) => {
    const userId = req.userId;
    const { slot, equipment } = req.body;
    if (![1, 2, 3].includes(slot))
        return res.status(400).json({ error: 'Неверный слот' });
    await index_1.db.run(`UPDATE users SET equipment_${slot} = ?::jsonb WHERE id = ?`, [JSON.stringify(equipment), userId]);
    // Если это активный слот — синхронизируем equipment
    const user = await index_1.db.one('SELECT active_equip_slot FROM users WHERE id = ?', [userId]);
    if ((user.active_equip_slot || 1) === slot) {
        await index_1.db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), userId]);
    }
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=character.js.map