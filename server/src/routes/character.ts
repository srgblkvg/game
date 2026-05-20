import { Router } from 'express';
import db from '../database';
import { currentStats, isSlotCompatible } from '../game/stats';

const router = Router();

// Загрузить персонажа (текущего пользователя)
router.get('/character/me', (req: any, res) => {
    const userId = req.userId;
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const inventory = JSON.parse(user.inventory || '[]');
    const equipment = JSON.parse(user.equipment || '{}');

    const getCraftData = db.prepare('SELECT type, image FROM craft_items WHERE id = ?');
    const enrichedInventory = inventory.map((item: any) => {
        if (item.type === 'craft_item' || item.type === 'material') {
            // Пробуем найти по id
            const craftRow = getCraftData.get(Number(item.id)) as any;
            if (craftRow) {
                return {
                    ...item,
                    itemType: craftRow.type || 'craft',
                    image: craftRow.image || null
                };
            }
            // Если не нашли, ищем по редкости и типу
            const craftByRarity = db.prepare('SELECT id, type, image FROM craft_items WHERE rarity = ? AND type = ?')
                .get(item.rarity, item.itemType || 'craft') as any;
            if (craftByRarity) {
                return {
                    ...item,
                    id: craftByRarity.id,          // обновляем id на правильный
                    itemType: craftByRarity.type || 'craft',
                    image: craftByRarity.image || null
                };
            }
        }
        return item;
    });

    if (JSON.stringify(enrichedInventory) !== JSON.stringify(inventory)) {
        db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(enrichedInventory), userId);
    }

    const stats = currentStats(
        { s: 5 * Math.pow(2, user.level - 1), a: 5 * Math.pow(2, user.level - 1), v: 100, d: 5 * Math.pow(2, user.level - 1), m: 5 * Math.pow(2, user.level - 1) },
        equipment
    );

    // Проверка завершённой работы
    let jobData = null;
    if (user.activeJob) {
        jobData = JSON.parse(user.activeJob);
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= jobData.endTime) {
            const newMoney = user.money + jobData.reward;
            db.prepare('UPDATE users SET money = ?, activeJob = NULL WHERE id = ?')
                .run(newMoney, userId);
            db.prepare('INSERT INTO job_history (userId, jobId, jobName, duration, reward, startedAt) VALUES (?, ?, ?, ?, ?, ?)')
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
        db.prepare('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?')
            .run(currentHp, now, userId);
    }

    const openPrivateTabs = JSON.parse(user.openPrivateTabs || '[]');

    if (user.inventory) {
        let inventory = JSON.parse(user.inventory);
        let changed = false;
        const getCraftType = db.prepare('SELECT type FROM craft_items WHERE id = ?');
        inventory = inventory.map((item: any) => {
            if ((item.type === 'craft_item' || item.type === 'material') && (!item.itemType || item.image === undefined)) {
                const craftRow = getCraftType.get(Number(item.id)) as any;
                if (craftRow) {
                    changed = true;
                    return { ...item, itemType: craftRow.type || 'craft', image: craftRow.image || null };
                }
            }
            return item;
        });
        if (changed) {
            // обновляем инвентарь в БД, чтобы в следующий раз не обогащать
            db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
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

    // Снятие предмета
    if (itemId === undefined || itemId === null) {
        if (!currentEquipped) return res.status(400).json({ error: 'Слот пуст' });
        inventory.push(currentEquipped);
        delete equipment[slotId];
        db.prepare('UPDATE users SET inventory = ?, equipment = ? WHERE id = ?')
            .run(JSON.stringify(inventory), JSON.stringify(equipment), userId);
        const now = Math.floor(Date.now() / 1000);
        db.prepare('UPDATE users SET lastHpUpdate = ? WHERE id = ?').run(now, userId);
        return res.json({ inventory, equipment });
    }

    // Надевание предмета
    const itemIndex = inventory.findIndex((i: any) => i.id == itemId);
    if (itemIndex === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });
    const item = inventory[itemIndex];
    if (!item || item.type === 'material') return res.status(400).json({ error: 'Нельзя надеть материал' });

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

    inventory.splice(itemIndex, 1);
    equipment[slotId] = item;

    db.prepare('UPDATE users SET inventory = ?, equipment = ? WHERE id = ?')
        .run(JSON.stringify(inventory), JSON.stringify(equipment), userId);

    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE users SET lastHpUpdate = ? WHERE id = ?').run(now, userId);

    res.json({ inventory, equipment });
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

    // Собираем редкости разбираемых предметов
    const materialsToAdd: { rarity: number; count: number }[] = [];
    inventory = inventory.filter((item: any) => {
        const itemIdStr = String(item.id);
        if (idsToDelete.has(itemIdStr) && item.type !== 'craft_item') {
            const rarity = item.rarity || 0;
            const existing = materialsToAdd.find(m => m.rarity === rarity);
            if (existing) existing.count += 1;
            else materialsToAdd.push({ rarity, count: 1 });
            return false;
        }
        return true;
    });

    // Для каждого полученного материала находим craft_item и добавляем в инвентарь
    const getCraftItemByRarity = db.prepare('SELECT id, name, rarity, type, image FROM craft_items WHERE rarity = ?');
    for (const mat of materialsToAdd) {
        const craftItem = getCraftItemByRarity.get(mat.rarity) as any;
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
                rarity: craftItem.rarity,
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

// Публичный профиль игрока
router.get('/character/public/:userId', (req: any, res) => {
    const userId = parseInt(req.params.userId);
    const user: any = db.prepare('SELECT id, username, level, totalBattles, wins, equipment, currentHp, gender FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const equipment = JSON.parse(user.equipment || '{}');
    const stats = currentStats(
        { s: 5 * Math.pow(2, user.level - 1), a: 5 * Math.pow(2, user.level - 1), v: 100, d: 5 * Math.pow(2, user.level - 1), m: 5 * Math.pow(2, user.level - 1) },
        equipment
    );

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
    const { tabs } = req.body; // массив ID пользователей
    if (!Array.isArray(tabs)) return res.status(400).json({ error: 'tabs должен быть массивом' });
    db.prepare('UPDATE users SET openPrivateTabs = ? WHERE id = ?').run(JSON.stringify(tabs), userId);
    res.json({ success: true });
});

export default router;