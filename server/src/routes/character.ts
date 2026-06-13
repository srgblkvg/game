import { Router } from 'express';
import db from '../database';
import { collectGuildTax } from '../db/helpers';
import { currentStats } from '../game/stats';
import { getDrinkBonuses } from '../game/drinks';
import { applyHpRegen } from '../game/hpRegen';
import { getUserById, getBaseStats, enrichEquipment } from '../db/helpers';

const router = Router();

const getItemData = db.prepare(`
    SELECT i.rarity_id, i.image, r.display_name as rarity_display, r.color as rarity_color
    FROM items i JOIN rarities r ON i.rarity_id = r.id
    WHERE i.name = ? AND i.slot = ?
`);
const getCraftData = db.prepare(`
    SELECT c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color
    FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
    WHERE c.id = ?
`);

// Загрузить персонажа (текущего пользователя)
router.get('/character/me', (req: any, res) => {
    const userId = req.userId;
    const user = getUserById(db, userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    let inventory = JSON.parse(user.inventory || '[]');
    const equipment = JSON.parse(user.equipment || '{}');
    let changed = false;

    inventory = inventory.map((item: any) => {
        if ((item.type === 'craft_item' || item.type === 'material')) {
            if (item.rarity_id === undefined) {
                const craftRow = getCraftData.get(Number(item.id)) as any;
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
                const itemRow = getItemData.get(item.name, item.slot) as any;
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
    });

    // Обогащаем экипировку
    const { enriched: enrichedEquipment, changed: equipChanged } = enrichEquipment(db, equipment);

    if (changed) {
        db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
    }
    if (equipChanged) {
        db.prepare('UPDATE users SET equipment = ? WHERE id = ?').run(JSON.stringify(enrichedEquipment), userId);
    }

    const base = getBaseStats(user);
    const drinkBonuses = getDrinkBonuses(user);
    const stats = currentStats(base, enrichedEquipment, drinkBonuses);

    // Бонус коллекции: +1% к основным статам за каждый предмет в коллекции
    const collectionCount = (db.prepare('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?').get(userId) as any).cnt;
    if (collectionCount > 0) {
        const bonus = 1 + collectionCount / 100;
        stats.s = Math.round(stats.s * bonus);
        stats.a = Math.round(stats.a * bonus);
        stats.d = Math.round(stats.d * bonus);
        stats.m = Math.round(stats.m * bonus);
        stats.hp = Math.round((stats.hp || 50) * bonus);
    }

    let jobData = null;
    if (user.activeJob) {
        jobData = JSON.parse(user.activeJob);
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= jobData.endTime) {
            // Налог гильдии (работы)
            const rewardAfterTax = collectGuildTax(db, userId, jobData.reward, 'tax_job');
            const newMoney = user.money + rewardAfterTax;
            const expGain = jobData.expReward || 0;
            let newExp = user.exp + expGain;
            let newLevel = user.level;
            let levelsGained = 0;
            while (true) {
                const required = 10 * Math.pow(2, newLevel - 1);
                if (newExp >= required) {
                    newExp -= required;
                    newLevel++;
                    levelsGained++;
                } else break;
            }
            const newStatPoints = (user.statPoints || 0) + levelsGained * 5;
            db.prepare('UPDATE users SET money = ?, exp = ?, level = ?, statPoints = ?, activeJob = NULL, totalJobMoney = totalJobMoney + ?, totalJobSeconds = totalJobSeconds + ? WHERE id = ?')
                .run(newMoney, newExp, newLevel, newStatPoints, jobData.reward, jobData.duration, userId);
            db.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt, premiumBonus, xpGained) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                .run(userId, jobData.jobId, jobData.name, jobData.duration, jobData.reward, new Date(jobData.startTime * 1000).toISOString(), jobData.premiumBonus || 0, expGain);
            user.money = newMoney;
            user.level = newLevel;
            user.statPoints = newStatPoints;
            user.activeJob = null;
            jobData = null;
        }
    }

    const now = Math.floor(Date.now() / 1000);
    const maxHp = stats.hp;
    let currentHp = applyHpRegen({
        id: user.id,
        currentHp: user.currentHp,
        maxHp,
        lastHpUpdate: user.lastHpUpdate || 0,
        roomType: user.roomType,
        roomUntil: user.roomUntil,
    });

    // Если currentHp > maxHp (например после изменения бонусов) — ограничиваем
    if (currentHp > maxHp) {
        currentHp = maxHp;
        db.prepare('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?').run(maxHp, now, userId);
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
    });
});

// Сохранить персонажа (полное обновление)
router.post('/character/save', (req: any, res) => {
    const userId = req.userId;
    const { inventory, equipment, level, exp, money, totalBattles, wins } = req.body;
    db.prepare('UPDATE users SET level=?, exp=?, money=?, totalBattles=?, wins=?, inventory=?, equipment=? WHERE id=?')
        .run(level, exp, money, totalBattles, wins, JSON.stringify(inventory), JSON.stringify(equipment), userId);
    res.json({ success: true });
});

// Сохранение открытых вкладок приватного чата
router.post('/character/save-tabs', (req: any, res) => {
    const userId = req.userId;
    const { tabs } = req.body;
    if (!Array.isArray(tabs)) return res.status(400).json({ error: 'tabs должен быть массивом' });
    db.prepare('UPDATE users SET openPrivateTabs = ? WHERE id = ?').run(JSON.stringify(tabs), userId);
    res.json({ success: true });
});

// Поиск пользователя по нику (для перехода из чата в профиль)
router.get('/users/find', (req: any, res) => {
    const username = req.query.username as string;
    if (!username) return res.status(400).json({ error: 'Укажите username' });
    const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});

// Поиск пользователей по части имени
router.get('/users/search', (req: any, res) => {
    const q = req.query.q as string;
    if (!q || q.length < 2) return res.json([]);
    const users = db.prepare(
        'SELECT id, username, level FROM users WHERE username LIKE ? AND id > 0 LIMIT 10'
    ).all(`%${q}%`);
    res.json(users);
});

export default router;
