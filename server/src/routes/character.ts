import { Router } from 'express';
import db from '../database';
import { currentStats, isSlotCompatible } from '../game/stats';

const router = Router();

// Загрузить персонажа (текущего пользователя)
router.get('/character/me', (req: any, res) => {
    const userId = req.userId;
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    let inventory = JSON.parse(user.inventory || '[]');
    const equipment = JSON.parse(user.equipment || '{}');
    let changed = false;

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

    // Обогащаем экипировку (если там есть предметы без rarity_id)
    let equipChanged = false;
    const enrichedEquipment: Record<string, any> = {};
    for (const [slotId, item] of Object.entries(equipment) as [string, any][]) {
        if (item && item.slot && item.rarity_id === undefined) {
            const itemRow = getItemData.get(item.name, item.slot) as any;
            if (itemRow) {
                equipChanged = true;
                enrichedEquipment[slotId] = {
                    ...item,
                    rarity_id: itemRow.rarity_id,
                    rarity_display: itemRow.rarity_display,
                    rarity_color: itemRow.rarity_color,
                    image: itemRow.image || item.image || null,
                };
            } else {
                enrichedEquipment[slotId] = item;
            }
        } else {
            enrichedEquipment[slotId] = item;
        }
    }

    if (changed) {
        db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
    }
    if (equipChanged) {
        db.prepare('UPDATE users SET equipment = ? WHERE id = ?').run(JSON.stringify(enrichedEquipment), userId);
    }

    const base = { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 };
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

    // Регенерация HP: 1 HP каждые 10 секунд вне боя
    const HP_REGEN_SECONDS = 10;
    const elapsed = now - (user.lastHpUpdate || now);
    if (elapsed > 0 && currentHp < maxHp) {
        const regenAmount = Math.floor(elapsed / HP_REGEN_SECONDS);
        if (regenAmount > 0) {
            currentHp = Math.min(maxHp, currentHp + regenAmount);
        }
    }

    // Если currentHp больше max HP (баг), корректируем
    if (currentHp > maxHp) {
        currentHp = maxHp;
    }

    // Сохраняем, если изменилось
    if (currentHp !== user.currentHp) {
        db.prepare('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?')
            .run(currentHp, now - (elapsed % HP_REGEN_SECONDS), userId);
    }

    const openPrivateTabs = JSON.parse(user.openPrivateTabs || '[]');

    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        exp: user.exp,
        money: user.money,
        totalBattles: user.totalBattles,
        wins: user.wins,
        inventory,
        equipment: enrichedEquipment,
        baseStats: { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 },
        currentHp,
        stats,
        lastAttackTime: user.lastAttackTime || 0,
        protectionUntil: user.protectionUntil || 0,
        inventorySlots: user.inventorySlots || 10,
        activeJob: jobData,
        role: user.role || 'player',
        openPrivateTabs,
        gender: user.gender || 'male',
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

// Экипировка/снятие предмета
router.post('/character/equip', (req: any, res) => {
    const userId = req.userId;
    const { slotId, itemId } = req.body;
    if (!slotId) return res.status(400).json({ error: 'slotId required' });

    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inventory: any[] = JSON.parse(user.inventory || '[]');
    const equipment: Record<string, any> = JSON.parse(user.equipment || '{}');
    const currentEquipped = equipment[slotId];

    if (itemId === undefined || itemId === null) {
        if (!currentEquipped) return res.status(400).json({ error: 'Слот пуст' });

        // Считаем старый max HP
        const base = { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 };
        const oldStats = currentStats(base, equipment);
        const oldMaxHp = oldStats.hp;

        inventory.push(currentEquipped);
        delete equipment[slotId];

        // Считаем новый max HP и корректируем currentHp
        const newStats = currentStats(base, equipment);
        const newMaxHp = newStats.hp;
        const newHp = Math.max(1, Math.floor(user.currentHp * newMaxHp / (oldMaxHp || 1)));

        const now = Math.floor(Date.now() / 1000);
        db.prepare('UPDATE users SET inventory = ?, equipment = ?, currentHp = ?, lastHpUpdate = ? WHERE id = ?')
            .run(JSON.stringify(inventory), JSON.stringify(equipment), newHp, now, userId);
        return res.json({ inventory, equipment, currentHp: newHp, maxHp: newMaxHp });
    }

    const itemIndex = inventory.findIndex((i: any) => i.id == itemId);
    if (itemIndex === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    const item = inventory[itemIndex];
    if (!item || item.type === 'material' || item.type === 'craft_item') return res.status(400).json({ error: 'Нельзя надеть материал или ресурс' });

    if (!isSlotCompatible(slotId, item)) return res.status(400).json({ error: 'Предмет не подходит к слоту' });

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

    // Считаем старый max HP до смены экипировки
    const base = { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 };
    const oldStats = currentStats(base, equipment);

    inventory.splice(itemIndex, 1);
    equipment[slotId] = item;

    // Считаем новый max HP и корректируем currentHp
    const newStats = currentStats(base, equipment);
    const newMaxHp = newStats.hp;
    const newHp = Math.max(1, Math.floor(user.currentHp * newMaxHp / (oldStats.hp || 1)));

    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE users SET inventory = ?, equipment = ?, currentHp = ?, lastHpUpdate = ? WHERE id = ?')
        .run(JSON.stringify(inventory), JSON.stringify(equipment), newHp, now, userId);

    res.json({ inventory, equipment, currentHp: newHp, maxHp: newMaxHp });
});

// Разобрать предмет(ы)
router.post('/character/salvage', (req: any, res) => {
    const userId = req.userId;
    const { itemIds } = req.body;
    if (!itemIds) return res.status(400).json({ error: 'itemIds required' });

    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let inventory: any[] = JSON.parse(user.inventory || '[]');
    const idsToDelete = new Set(itemIds.map((id: any) => String(id)));

    const materialsToAdd: { rarity_id: number; count: number }[] = [];
    inventory = inventory.filter((item: any) => {
        const itemIdStr = String(item.id);
        if (idsToDelete.has(itemIdStr) && item.type !== 'craft_item') {
            const rarityId = item.rarity_id ?? 0;
            const existing = materialsToAdd.find(m => m.rarity_id === rarityId);
            if (existing) existing.count += 1;
            else materialsToAdd.push({ rarity_id: rarityId, count: 1 });
            return false;
        }
        return true;
    });

    const getCraftItemByRarityId = db.prepare(`
        SELECT c.id, c.name, c.rarity_id, c.type, c.image,
               r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.rarity_id = ?
    `);

    for (const mat of materialsToAdd) {
        const craftItem = getCraftItemByRarityId.get(mat.rarity_id) as any;
        if (!craftItem) continue;

        const existingCraft = inventory.find(
            (i: any) => i.type === 'craft_item' && i.id === craftItem.id
        );
        if (existingCraft) {
            existingCraft.count += mat.count;
        } else {
            inventory.push({
                type: 'craft_item',
                id: craftItem.id,
                name: craftItem.name,
                rarity_id: craftItem.rarity_id,
                rarity_display: craftItem.rarity_display,
                rarity_color: craftItem.rarity_color,
                count: mat.count,
                itemType: craftItem.type || 'craft',
                image: craftItem.image || null,
            });
        }
    }

    db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
    res.json({ success: true, inventory });
});

// Расширить инвентарь
router.post('/character/expand-inventory', (req: any, res) => {
    const userId = req.userId;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentSlots = user.inventorySlots || 10;
    const price = 100 * Math.pow(2, currentSlots - 10);
    if (user.money < price) return res.status(400).json({ error: 'Недостаточно монет' });

    db.prepare('UPDATE users SET money = money - ?, inventorySlots = inventorySlots + 1 WHERE id = ?')
        .run(price, userId);

    res.json({ inventorySlots: currentSlots + 1, moneyAfter: user.money - price });
});

// Поиск пользователя по нику (для чата)
router.get('/users/find', (req: any, res) => {
    let username = req.query.username as string;
    if (!username) return res.status(400).json({ error: 'username required' });
    if (username.startsWith('@')) {
        username = username.slice(1);
    }
    const user = db.prepare(
        'SELECT id, username, level FROM users WHERE LOWER(username) = LOWER(?)'
    ).get(username);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(user);
});

// Публичный профиль игрока
router.get('/character/public/:userId', (req: any, res) => {
    const userId = parseInt(req.params.userId);
    const user: any = db.prepare('SELECT id, username, level, totalBattles, wins, equipment, currentHp, gender FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const equipment = JSON.parse(user.equipment || '{}');

    const getItemData = db.prepare(`
        SELECT i.rarity_id, i.image, r.display_name as rarity_display, r.color as rarity_color
        FROM items i JOIN rarities r ON i.rarity_id = r.id
        WHERE i.name = ? AND i.slot = ?
    `);
    const enrichedEquipment: Record<string, any> = {};
    for (const [slotId, item] of Object.entries(equipment) as [string, any][]) {
        if (item && item.slot && item.rarity_id === undefined) {
            const itemRow = getItemData.get(item.name, item.slot) as any;
            if (itemRow) {
                enrichedEquipment[slotId] = {
                    ...item,
                    rarity_id: itemRow.rarity_id,
                    rarity_display: itemRow.rarity_display,
                    rarity_color: itemRow.rarity_color,
                    image: itemRow.image || item.image || null,
                };
            } else {
                enrichedEquipment[slotId] = item;
            }
        } else {
            enrichedEquipment[slotId] = item;
        }
    }

    const base = { s: user.baseS ?? 5, a: user.baseA ?? 5, d: user.baseD ?? 5, m: user.baseM ?? 5 };
    const stats = currentStats(base, enrichedEquipment);

    res.json({
        id: user.id,
        username: user.username,
        level: user.level,
        totalBattles: user.totalBattles,
        wins: user.wins,
        equipment: enrichedEquipment,
        stats,
        currentHp: user.currentHp,
        gender: user.gender || 'male',
    });
});

// Рейтинг игроков (по победам)
router.get('/rating', (req: any, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const total = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as any).cnt;
    const users = db.prepare(`
        SELECT id, username, level, wins
        FROM users
        ORDER BY wins DESC, level DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    res.json({ users, total });
});

// Сохранение открытых вкладок приватного чата
router.post('/character/save-tabs', (req: any, res) => {
    const userId = req.userId;
    const { tabs } = req.body;
    if (!Array.isArray(tabs)) return res.status(400).json({ error: 'tabs должен быть массивом' });
    db.prepare('UPDATE users SET openPrivateTabs = ? WHERE id = ?').run(JSON.stringify(tabs), userId);
    res.json({ success: true });
});

// GET /users/list?ids=1,2,3
router.get('/users/list', (req: any, res) => {
    const idsParam = req.query.ids as string;
    if (!idsParam) return res.json([]);
    const ids = idsParam.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.json([]);
    const placeholders = ids.map(() => '?').join(',');
    const users = db.prepare(`SELECT id, username FROM users WHERE id IN (${placeholders})`).all(...ids);
    res.json(users);
});

// Распределение очков статов
router.post('/character/allocate-stats', (req: any, res) => {
    const userId = req.userId;
    const { s, a, d, m } = req.body;
    const total = (s || 0) + (a || 0) + (d || 0) + (m || 0);
    if (total <= 0) return res.status(400).json({ error: 'Укажите, сколько очков распределить' });

    const user: any = db.prepare('SELECT statPoints, baseS, baseA, baseD, baseM FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (total > (user.statPoints || 0)) return res.status(400).json({ error: 'Недостаточно очков' });

    const newS = (user.baseS || 5) + (s || 0);
    const newA = (user.baseA || 5) + (a || 0);
    const newD = (user.baseD || 5) + (d || 0);
    const newM = (user.baseM || 5) + (m || 0);
    const newPoints = (user.statPoints || 0) - total;

    db.prepare('UPDATE users SET baseS = ?, baseA = ?, baseD = ?, baseM = ?, statPoints = ? WHERE id = ?')
        .run(newS, newA, newD, newM, newPoints, userId);

    res.json({ baseS: newS, baseA: newA, baseD: newD, baseM: newM, statPoints: newPoints });
});

// Список названий характеристик
router.get('/stat-names', (req: any, res) => {
    const stats = db.prepare('SELECT * FROM stat_names').all();
    res.json(stats);
});

export default router;