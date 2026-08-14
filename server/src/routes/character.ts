import { Router } from 'express';
import { db } from '../db/index';
import { collectGuildTax, getUserById, enrichEquipment, applyExp, buildPlayerStats } from '../db/helpers';
import { sendLeaderboardLevel } from '../vkLeaderboard';
import { getDrinkBonuses } from '../game/drinks';
import { applyHpRegen } from '../game/hpRegen';
import { updateGuildQuestProgress } from './guild';
import { getGuildBonus, getGuildBuildings } from '../game/guildBuildings';
import { getTrackTier, TRACK_MAP } from '../game/achievements';
import { markDirty } from '../events';

const router = Router();

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
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    let inventory = JSON.parse(user.inventory || '[]');
    const activeSlot = user.active_equip_slot || 1;
    const equipKey = `equipment_${activeSlot}`;
    const parseEq = (v: any) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    const rawEq = parseEq((user as any)[equipKey]);
    const equipment = Object.keys(rawEq).length > 0 ? rawEq : parseEq(user.equipment);
    const equipment1 = parseEq(user.equipment_1);
    const equipment2 = parseEq(user.equipment_2);
    const equipment3 = parseEq(user.equipment_3);
    let changed = false;

    // Собираем уникальные ID крафт-предметов и загружаем данные одним запросом
    const craftIds = [...new Set(
      inventory.filter((i: any) => i.type === 'craft_item' || i.type === 'material').map((i: any) => Number(i.id))
    )];
    const craftDataMap: Record<number, any> = {};
    if (craftIds.length > 0) {
      const craftRows = await db.query(
        `SELECT c.id, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color
         FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
         WHERE c.id IN (${craftIds.join(',')})`,
        []
      ) as any[];
      for (const row of craftRows) craftDataMap[row.id] = row;
    }

    // Обогащаем инвентарь: крафт-предметы из кеша, шмот через БД
    inventory = await Promise.all(inventory.map(async (item: any) => {
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
        } else if (item.slot) {
            if (item.rarity_id === undefined || !item.image) {
                const itemRow = await db.one(ITEM_DATA_SQL, [item.name, item.slot]) as any;
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
    const { enriched: enrichedEquipment, changed: equipChanged } = await enrichEquipment(equipment);

    if (changed) {
        await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    }
    if (equipChanged) {
        await db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(enrichedEquipment), userId]);
    }

    const drinkBonuses = getDrinkBonuses(user);
    const collectionCount = (await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?', [userId]) as any).cnt;

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
    `, [userId]) as any;
    const totalCollectionBonus = (collectionCount || 0) + (completedSetBonus?.total || 0);
    const collectedItems = await db.query('SELECT itemName, slot, rarity_id, upgradelevel FROM collections WHERE userId = ?', [userId]) as any[];
    const guildBonus = await getGuildBonus(userId, 'arena');
    const buildings = await getGuildBuildings(userId);
    const stats = await buildPlayerStats(user, 'arena');

    const totalCollectionItems = ((await db.one('SELECT COUNT(*) as cnt FROM collection_set_items') as any).cnt || 225) * 2;

    let jobData = null;
    if (user.activeJob) {
        jobData = JSON.parse(user.activeJob);
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= jobData.endTime) {
            // Налог гильдии (работы)
            const rewardAfterTax = await collectGuildTax(userId, jobData.reward, 'tax_job');
            const newMoney = user.money + rewardAfterTax;
            const expGain = jobData.expReward || 0;
            const { newExp, newLevel, levelsGained, newStatPoints } = await applyExp(userId, expGain, user.exp, user.level, user.statPoints || 0);
            await db.run('UPDATE users SET money = ?, exp = ?, level = ?, statPoints = ?, activeJob = NULL, totalJobMoney = totalJobMoney + ?, totalJobSeconds = totalJobSeconds + ? WHERE id = ?',
                [newMoney, newExp, newLevel, newStatPoints, jobData.reward, jobData.duration, userId]);
            await db.run('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt, premiumBonus, xpGained) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, jobData.jobId, jobData.name, jobData.duration, jobData.reward, new Date(jobData.startTime * 1000).toISOString(), jobData.premiumBonus || 0, expGain]);
            if (levelsGained > 0 && user.oauthProvider === 'vk' && user.oauthId) {
                sendLeaderboardLevel(userId, newLevel, String(user.oauthId)).catch(() => {});
            }
            // Guild quest progress — track job seconds
            if (user.guildId) { updateGuildQuestProgress(user.guildId, 'jobs', jobData.duration).catch(e => console.error('guildQuest jobs:', e.message)); }
            // Daily quests — track job seconds
            markDirty(userId, 'quests');
            user.money = newMoney;
            user.level = newLevel;
            user.statPoints = newStatPoints;
            user.activeJob = null;
            jobData = null;
        }
    }

    const now = Math.floor(Date.now() / 1000);
    const maxHp = stats.hp;
    const hpRegenParams: any = {
        id: user.id,
        currentHp: user.currentHp,
        maxHp,
        lastHpUpdate: user.lastHpUpdate || 0,
        roomType: user.roomType,
        roomUntil: user.roomUntil,
        premiumUntil: user.premiumUntil,
    };
    if (stats.hermitRegen) hpRegenParams.hermitRegen = true;
    let currentHp = await applyHpRegen(hpRegenParams);

    // Если currentHp > maxHp (например после изменения бонусов) — ограничиваем
    if (currentHp > maxHp) {
        currentHp = maxHp;
        await db.run('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?', [maxHp, now, userId]);
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
        lastHpUpdate: now,  // регенерация уже применена сервером до now
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
        gold: user.gold || 0,
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
    await db.run('UPDATE users SET level=?, exp=?, money=?, totalBattles=?, wins=?, inventory=?, equipment=? WHERE id=?',
        [level, exp, money, totalBattles, wins, JSON.stringify(inventory), JSON.stringify(equipment), userId]);
    res.json({ success: true });
});

// Сохранение открытых вкладок приватного чата
router.post('/character/save-tabs', async (req, res) => {
    const userId = req.userId;
    const { tabs } = req.body;
    if (!Array.isArray(tabs)) return res.status(400).json({ error: 'tabs должен быть массивом' });
    await db.run('UPDATE users SET openPrivateTabs = ? WHERE id = ?', [JSON.stringify(tabs), userId]);
    res.json({ success: true });
});

// Отметить туториал как пройденный
router.post('/character/tutorial-done', async (req, res) => {
    const reward = 1000;
    const userId = req.userId;
    const result = await db.run(
        'UPDATE users SET tutorial_completed = 1, tutorial_step = GREATEST(COALESCE(tutorial_step, 0), 4), money = money + ? WHERE id = ? AND COALESCE(tutorial_completed, 0) = 0',
        [reward, userId],
    );
    res.json({ success: true, reward: result?.changes ? reward : 0 });
});

// Продвинуть туториал на один шаг вперёд (клиентская кнопка «Далее»)
router.post('/character/tutorial-step', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT tutorial_step, tutorial_completed FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentStep = user.tutorial_step || 0;
    // Четыре коротких экрана, индексы 0–3. Завершение и награда — отдельным endpoint.
    const LAST_STEP = 3;
    if (currentStep >= LAST_STEP) {
        return res.json({ success: true, step: LAST_STEP, completed: false });
    }

    await db.run('UPDATE users SET tutorial_step = tutorial_step + 1 WHERE id = ?', [userId]);

    const updated = await db.one('SELECT tutorial_step FROM users WHERE id = ?', [userId]) as any;
    const newStep = updated?.tutorial_step || 0;

    res.json({ success: true, step: newStep });
});

// Поиск пользователя по нику (для перехода из чата в профиль)
router.get('/users/find', async (req, res) => {
    const username = req.query.username as string;
    if (!username) return res.status(400).json({ error: 'Укажите username' });
    const user = await db.one('SELECT id, username FROM users WHERE username = ?', [username]) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});

// Поиск пользователей по части имени
router.get('/users/search', async (req, res) => {
    const q = req.query.q as string;
    if (!q || q.length < 2) return res.json([]);
    const users = await db.query(
        'SELECT id, username, level FROM users WHERE username LIKE ? AND id > 0 LIMIT 10',
        [`%${q}%`]
    );
    res.json(users);
});

// Премиум за рекламу (VK) — 1 час, раз в час
router.post('/premium/ad', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT premiumUntil, adpremiumat FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const cooldownSec = 3600; // 1 час
    if (now - (user.adpremiumat || 0) < cooldownSec) {
        const remaining = cooldownSec - (now - user.adpremiumat);
        return res.status(400).json({ error: `Реклама будет доступна через ${Math.ceil(remaining / 60)} мин.` });
    }

    const currentUntil = Math.max(user.premiumUntil || 0, now);
    const newUntil = currentUntil + 3600; // +1 час
    await db.run('UPDATE users SET premiumUntil = ?, adpremiumat = ? WHERE id = ?', [newUntil, now, userId]);

    res.json({ success: true, premiumUntil: newUntil, message: 'Премиум активирован на 1 час!' });
});

// Серебро за рекламу (VK) — 1000, раз в 30 минут
router.post('/shop/ad-silver', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT money, adsilverat FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const cooldownSec = 300; // 5 минут
    if (now - (user.adsilverat || 0) < cooldownSec) {
        const remaining = cooldownSec - (now - user.adsilverat);
        return res.status(400).json({ error: `Реклама будет доступна через ${Math.ceil(remaining / 60)} мин.` });
    }

    const reward = 1000;
    await db.run('UPDATE users SET money = money + ?, adsilverat = ? WHERE id = ?', [reward, now, userId]);

    res.json({ success: true, reward, message: `Получено ${reward} серебра за рекламу!` });
});

// Переключение активного слота экипировки (I/II/III)
// Сохраняет текущий equipment в старый слот, загружает новый
router.post('/character/switch-equip', async (req, res) => {
    const userId = req.userId;
    const { slot } = req.body; // 1, 2 или 3
    if (![1, 2, 3].includes(slot)) return res.status(400).json({ error: 'Неверный слот' });

    const user = await db.one('SELECT equipment, equipment_1, equipment_2, equipment_3, active_equip_slot FROM users WHERE id = ?', [userId]) as any;
    const oldSlot = user.active_equip_slot || 1;
    if (oldSlot === slot) return res.json({ success: true, activeEquipSlot: slot });

    const parseEq = (v: any) => typeof v === 'string' ? v : JSON.stringify(v);
    const parseEqObj = (v: any): Record<string, any> => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    const currentEquip = parseEq(user.equipment);
    const targetEquip = parseEq((user as any)[`equipment_${slot}`]);

    // Сохраняем текущий equipment в старый слот, загружаем новый в equipment
    await db.run(
        `UPDATE users SET equipment_${oldSlot} = ?::jsonb, equipment = ?, active_equip_slot = ? WHERE id = ?`,
        [currentEquip, targetEquip, slot, userId]
    );

    res.json({ success: true, activeEquipSlot: slot, equipment: parseEqObj(targetEquip) });
});

// Сохранить экипировку в конкретный слот (без переключения)
router.post('/character/save-equip-set', async (req, res) => {
    const userId = req.userId;
    const { slot, equipment } = req.body;
    if (![1, 2, 3].includes(slot)) return res.status(400).json({ error: 'Неверный слот' });

    await db.run(
        `UPDATE users SET equipment_${slot} = ?::jsonb WHERE id = ?`,
        [JSON.stringify(equipment), userId]
    );

    // Если это активный слот — синхронизируем equipment
    const user = await db.one('SELECT active_equip_slot FROM users WHERE id = ?', [userId]) as any;
    if ((user.active_equip_slot || 1) === slot) {
        await db.run('UPDATE users SET equipment = ? WHERE id = ?', [JSON.stringify(equipment), userId]);
    }

    res.json({ success: true });
});

export default router;
