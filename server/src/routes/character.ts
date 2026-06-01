import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
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
    const stats = currentStats(base, enrichedEquipment);

    let jobData = null;
    if (user.activeJob) {
        jobData = JSON.parse(user.activeJob);
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= jobData.endTime) {
            const newMoney = user.money + jobData.reward;
            const expGain = jobData.expReward || 0;
            const newExp = user.exp + expGain;
            db.prepare('UPDATE users SET money = ?, exp = ?, activeJob = NULL WHERE id = ?')
                .run(newMoney, newExp, userId);
            db.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, jobData.jobId, jobData.name, jobData.duration, jobData.reward, new Date(jobData.startTime * 1000).toISOString());
            user.money = newMoney;
            user.activeJob = null;
            jobData = null;
        }
    }

    const now = Math.floor(Date.now() / 1000);
    const maxHp = stats.hp;
    let currentHp = user.currentHp;
    const HP_REGEN_SECONDS = 10;
    const elapsed = now - (user.lastHpUpdate || now);
    if (elapsed > 0 && currentHp < maxHp) {
        const regenAmount = Math.floor(elapsed / HP_REGEN_SECONDS);
        if (regenAmount > 0) currentHp = Math.min(maxHp, currentHp + regenAmount);
    }
    if (currentHp > maxHp) currentHp = maxHp;
    if (currentHp !== user.currentHp) {
        db.prepare('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?')
            .run(currentHp, now - (elapsed % HP_REGEN_SECONDS), userId);
    }

    const openPrivateTabs = JSON.parse(user.openPrivateTabs || '[]');

    res.json({
        id: user.id, username: user.username, level: user.level,
        exp: user.exp, money: user.money, totalBattles: user.totalBattles,
        wins: user.wins, inventory, equipment: enrichedEquipment,
        baseStats: { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 },
        currentHp, stats, lastAttackTime: user.lastAttackTime || 0,
        protectionUntil: user.protectionUntil || 0,
        inventorySlots: user.inventorySlots || 10,
        activeJob: jobData, role: user.role || 'player',
        openPrivateTabs, gender: user.gender || 'male',
        statPoints: user.statPoints || 0,
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

export default router;
