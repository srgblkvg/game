import { Router } from 'express';
import { db } from '../db/index';
import { collectGuildTax, getUserById, enrichEquipment, applyExp, buildPlayerStats } from '../db/helpers';
import { sendLeaderboardLevel } from '../vkLeaderboard';
import { getDrinkBonuses } from '../game/drinks';
import { applyHpRegen } from '../game/hpRegen';
import { updateGuildQuestProgress } from './guild';
import { getGuildBonus, getGuildBuildings } from '../game/guildBuildings';
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
    const equipment = JSON.parse(user.equipment || '{}');
    let changed = false;

    inventory = await Promise.all(inventory.map(async (item: any) => {
        if ((item.type === 'craft_item' || item.type === 'material')) {
            if (item.rarity_id === undefined) {
                const craftRow = await db.one(CRAFT_DATA_SQL, [Number(item.id)]) as any;
                if (craftRow) {
                    changed = true;
                    return {
                        ...item,
                        rarity_id: craftRow.rarity_id,
                        rarity_display: craftRow.rarity_display,
                        rarity_color: craftRow.rarity_color,
                        itemType: item.itemType || craftRow.type || 'craft',
                        image: item.image ?? craftRow.image ?? null,
                    };
                }
            }
        } else if (item.slot) {
            if (item.rarity_id === undefined) {
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
    const collectedItems = await db.query('SELECT itemName, slot FROM collections WHERE userId = ?', [userId]) as any[];
    const guildBonus = await getGuildBonus(userId, 'arena');
    const buildings = await getGuildBuildings(userId);
    const stats = await buildPlayerStats(user, 'arena');

    const totalCollectionItems = (await db.one('SELECT COUNT(*) as cnt FROM collection_set_items') as any).cnt;

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
            if (user.guildId) { updateGuildQuestProgress(user.guildId).catch(e => console.error('guildQuest jobs:', e.message)); }
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
    let currentHp = await applyHpRegen({
        id: user.id,
        currentHp: user.currentHp,
        maxHp,
        lastHpUpdate: user.lastHpUpdate || 0,
        roomType: user.roomType,
        roomUntil: user.roomUntil,
        premiumUntil: user.premiumUntil,
    });

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
        lastHpUpdate: user.lastHpUpdate || 0,
        lastPveAttackTime: user.lastPveAttackTime || 0,
        attackCooldownSec: Math.max(0, ((user.premiumUntil || 0) > now ? 150 : 300) - (now - (user.lastAttackTime || 0))),
        pveCooldownSec: Math.max(0, ((user.premiumUntil || 0) > now ? 150 : 300) - (now - (user.lastPveAttackTime || 0))),
        inventorySlots: user.inventorySlots || 10,
        activeJob: jobData, role: user.role || 'player',
        bank: user.bank || 0,
        guildId: user.guildId || null,
        lastBankVisit: user.lastBankVisit || 0,
        room: user.roomType && user.roomUntil > now ? { type: user.roomType, until: user.roomUntil } : null,
        drink: user.activeDrink && user.drinkUntil > now ? { type: user.activeDrink, until: user.drinkUntil } : null,
        premium: user.premiumUntil > now ? { until: user.premiumUntil } : null,
        drinkBonuses,
        openPrivateTabs, gender: user.gender || 'male',
        statPoints: user.statPoints || 0,
        collectionCount: collectionCount || 0,
        collectedItems: collectedItems || [],
        guildBonus,
        buildings,
        totalCollectionItems: totalCollectionItems || 189,
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

export default router;
