import { Router } from 'express';
import { db } from '../db/index';
import { checkAchievement } from './achievements';
import { requireFullAccess } from '../middleware/auth';
import { updateGuildQuestProgress } from './guild';
import { markDirty, broadcast } from '../events';
import { addToTreasury } from '../game/treasury';

const router = Router();

// Все маршруты крафта требуют полный доступ
// router.use('/craft', requireFullAccess); // отключено для гостей

function isCraftItem(item: any): boolean {
    return item?.type === 'material' || item?.type === 'craft_item';
}

// Получить все рецепты (для игрока)
router.get('/craft/recipes', async (req, res) => {
    const recipes = await db.query('SELECT * FROM craft_recipes ORDER BY id', []) as any[];
    for (const recipe of recipes) {
        recipe.ingredients = await db.query(`
      SELECT ci.id as craft_item_id, ci.name, ci.rarity_id, ci.type as itemType, ci.image, cri.quantity,
             r.display_name as rarity_display, r.color as rarity_color
      FROM craft_recipe_ingredients cri
      JOIN craft_items ci ON ci.id = cri.craft_item_id
      JOIN rarities r ON ci.rarity_id = r.id
      WHERE cri.recipe_id = ?
    `, [recipe.id]);

        if (recipe.result_type === 'item') {
            const rawResult = await db.one(`
        SELECT i.id, i.name, i.slot, i.rarity_id, i.image, i.bonuses, i.extra,
               r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        WHERE i.id = ?
      `, [recipe.result_id]) as any;
            recipe.result = rawResult ? {
                ...rawResult,
                bonuses: typeof rawResult.bonuses === 'string' ? JSON.parse(rawResult.bonuses || '{}') : (rawResult.bonuses || {}),
                extra: typeof rawResult.extra === 'string' ? JSON.parse(rawResult.extra || '{}') : (rawResult.extra || {}),
            } : null;
        } else if (recipe.result_type === 'random_item') {
            // result_id = rarity_id, показываем инфо о редкости
            recipe.result = await db.one(
                'SELECT id as rarity_id, display_name as rarity_display, color as rarity_color, name FROM rarities WHERE id = ?',
                [recipe.result_id]
            ) || null;
            if (recipe.result) recipe.result.name = `Случайный предмет (${recipe.result.rarity_display})`;
        } else if (recipe.result_type === 'craft_item') {
            recipe.result = await db.one(`
        SELECT c.id, c.name, c.rarity_id, c.image, c.type as itemType,
               r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.id = ?
      `, [recipe.result_id]) || null;
        } else {
            recipe.result = null;
        }

        // Категория
        recipe.category = await db.one('SELECT * FROM craft_recipe_categories WHERE id = ?', [recipe.category_id]) || null;
    }
    res.json(recipes);
});

// Выполнить крафт по рецепту
router.post('/craft/execute', async (req, res) => {
    const userId = req.userId;
    const recipe_id = req.body.recipeId || req.body.recipe_id;

    if (!recipe_id) return res.status(400).json({ error: 'recipe_id required' });

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recipe = await db.one('SELECT * FROM craft_recipes WHERE id = ?', [Number(recipe_id)]) as any;
    if (!recipe) return res.status(400).json({ error: 'Рецепт не найден' });

    const ingredients = await db.query(`
    SELECT ci.id, ci.name, ci.rarity_id, ci.type as itemType, cri.quantity,
           r.display_name as rarity_display, r.color as rarity_color
    FROM craft_recipe_ingredients cri
    JOIN craft_items ci ON ci.id = cri.craft_item_id
    JOIN rarities r ON ci.rarity_id = r.id
    WHERE cri.recipe_id = ?
  `, [recipe.id]) as any[];

    let inventory: any[] = JSON.parse(user.inventory || '[]');
    const ingredientMap = new Map<string, number>();
    for (const ing of ingredients) {
        ingredientMap.set(String(ing.id), ing.quantity);
    }

    // Проверка ресурсов до списания
    for (const [itemId, needed] of ingredientMap) {
        const existing = inventory.find((i: any) => isCraftItem(i) && String(i.id) === String(itemId));
        if (!existing || existing.count < needed) {
            return res.status(400).json({ error: `Недостаточно ресурса (требуется ${needed})` });
        }
    }

    // Проверка денег
    if (user.money < recipe.money_cost) {
        return res.status(400).json({ error: 'Недостаточно денег' });
    }

    // Проверка заполненности инвентаря для результата-предмета
    if (recipe.result_type === 'item') {
        const inventorySlots = user.inventorySlots || 10;
        const equipmentCount = inventory.filter((item: any) => !isCraftItem(item)).length;
        if (equipmentCount >= inventorySlots) {
            return res.status(400).json({ error: 'Инвентарь заполнен' });
        }
    }

    // Списание ресурсов
    let newInventory = inventory.map((item) => {
        if (isCraftItem(item) && ingredientMap.has(String(item.id))) {
            const needed = ingredientMap.get(String(item.id))!;
            if (item.count > needed) {
                return { ...item, count: item.count - needed };
            } else {
                ingredientMap.delete(String(item.id));
                return null;
            }
        }
        return item;
    }).filter(Boolean);

    const newMoney = user.money - recipe.money_cost;
    const chance = (recipe.success_chance ?? 100) + (user.faction === 'crafter' ? 10 : 0);
    const success = Math.random() * 100 < chance;

    if (success) {
        let craftedItem: any = null;
        if (recipe.result_type === 'item') {
            const resultItem = await db.one(`
        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        WHERE i.id = ?
      `, [recipe.result_id]) as any;
            if (!resultItem) return res.status(500).json({ error: 'Результирующий предмет не найден' });
            craftedItem = {
                id: Date.now() + Math.random(),
                name: resultItem.name,
                slot: resultItem.slot,
                rarity_id: resultItem.rarity_id,
                rarity_display: resultItem.rarity_display,
                rarity_color: resultItem.rarity_color,
                bonuses: JSON.parse(resultItem.bonuses || '{}'),
                extra: JSON.parse(resultItem.extra || '{}'),
                image: resultItem.image || null,
                upgradeLevel: 0,
            };
            newInventory.push(craftedItem);
        } else if (recipe.result_type === 'random_item') {
            // Случайный предмет указанной редкости (result_id = rarity_id)
            const rarityId = recipe.result_id;
            const randomItem = await db.one(`
                SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
                FROM items i
                JOIN rarities r ON i.rarity_id = r.id
                WHERE i.rarity_id = ?
                  AND (i.extra IS NULL OR i.extra::text NOT LIKE '%"set"%')
                ORDER BY RANDOM() LIMIT 1
            `, [rarityId]) as any;
            if (!randomItem) return res.status(500).json({ error: 'Нет предметов такой редкости' });
            craftedItem = {
                id: Date.now() + Math.random(),
                name: randomItem.name,
                slot: randomItem.slot,
                rarity_id: randomItem.rarity_id,
                rarity_display: randomItem.rarity_display,
                rarity_color: randomItem.rarity_color,
                bonuses: JSON.parse(randomItem.bonuses || '{}'),
                extra: JSON.parse(randomItem.extra || '{}'),
                image: randomItem.image || null,
                upgradeLevel: 0,
            };
            newInventory.push(craftedItem);
        } else if (recipe.result_type === 'craft_item') {
            const resultCraftItem = await db.one(`
        SELECT c.*, r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.id = ?
      `, [recipe.result_id]) as any;
            if (!resultCraftItem) return res.status(500).json({ error: 'Результирующий ресурс не найден' });
            const existing = newInventory.find((i: any) => isCraftItem(i) && String(i.id) === String(recipe.result_id));
            if (existing) {
                existing.count += 1;
                craftedItem = { ...existing, count: 1 }; // для уведомления: одна штука
            } else {
                craftedItem = {
                    type: 'craft_item',
                    id: resultCraftItem.id,
                    name: resultCraftItem.name,
                    rarity_id: resultCraftItem.rarity_id,
                    rarity_display: resultCraftItem.rarity_display,
                    rarity_color: resultCraftItem.rarity_color,
                    count: 1,
                    itemType: resultCraftItem.type || 'craft',
                    image: resultCraftItem.image || null,
                };
                newInventory.push(craftedItem);
            }
        }

        await db.run('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftCreated = craftCreated + 1 WHERE id = ?', [JSON.stringify(newInventory), newMoney, userId]);
        checkAchievement(userId, 'craft').catch(() => {});
        addToTreasury(Math.floor(recipe.money_cost * 0.22), 'craft_recipe').catch(() => {});
        const u = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
        if (u?.guildId) { updateGuildQuestProgress(u.guildId, 'craft').catch(e => console.error('guildQuest craft:', e.message)); }
        markDirty(userId, 'quests');
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, item: craftedItem, message: 'Предмет создан!' });
    } else {
        await db.run('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?', [JSON.stringify(newInventory), newMoney, userId]);
        addToTreasury(Math.floor(recipe.money_cost * 0.22), 'craft_recipe_fail').catch(() => {});
        return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача, предмет разрушен' });
    }
});

// Получить информацию об улучшении (шанс и стоимость) для конкретного уровня и редкости
router.get('/craft/upgrade-info/:level/:rarity', async (req, res) => {
    const level = Number(req.params.level);
    const rarity = Number(req.params.rarity);
    const data = await db.one('SELECT chance, money_cost FROM upgrade_chances WHERE level = ? AND rarity_id = ?', [level, rarity]) as any;
    if (!data) return res.status(404).json({ error: 'Данные об уровне не найдены' });
    res.json({ chance: data.chance, money_cost: Math.max(1, Math.floor(data.money_cost / 4)) });
});

// Улучшение предмета
router.post('/craft/upgrade', async (req, res) => {
    const userId = req.userId;
    const { slots } = req.body;

    if (!Array.isArray(slots) || slots.length !== 2) {
        return res.status(400).json({ error: 'Нужно ровно два слота: предмет и камень усиления' });
    }

    // Определяем предмет и камень независимо от порядка
    const itemSlot = slots.find((s: any) => s && !isCraftItem(s));
    const stoneSlot = slots.find((s: any) => s && isCraftItem(s) && s.itemType === 'upgrade');

    if (!itemSlot || !stoneSlot) {
        return res.status(400).json({ error: 'Положите предмет и камень усиления' });
    }

    // Камень любой редкости может улучшать предмет любой редкости

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    let inventory: any[] = JSON.parse(user.inventory || '[]');

    const itemIndex = inventory.findIndex((i: any) => i.id === itemSlot.id && !isCraftItem(i));
    if (itemIndex === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });

    const itemToUpgrade = inventory[itemIndex];
    if (itemToUpgrade.locked) return res.status(400).json({ error: 'Предмет заблокирован. Разблокируйте в инвентаре.' });
    const currentLevel = itemToUpgrade.upgradeLevel || 0;
    const targetLevel = currentLevel + 1;

    const stoneIndex = inventory.findIndex((i: any) => isCraftItem(i) && i.id === stoneSlot.id && i.itemType === 'upgrade');
    if (stoneIndex === -1) return res.status(400).json({ error: 'Камень усиления не найден в инвентаре' });

    const stone = inventory[stoneIndex];
    if (stone.count < 1) return res.status(400).json({ error: 'Недостаточно камней усиления' });

    const upgradeData = await db.one('SELECT chance, money_cost FROM upgrade_chances WHERE level = ? AND rarity_id = ?', [targetLevel, itemSlot.rarity_id]) as any;
    if (!upgradeData) {
        return res.status(400).json({ error: 'Нет данных для этого уровня улучшения. Свяжитесь с администратором.' });
    }

    const { chance, money_cost } = upgradeData;
    // Бонус к шансу от редкости камня
    const STONE_BONUS: Record<number, number> = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20, 5: 30, 6: 50 };
    const stoneBonus = STONE_BONUS[stone.rarity_id] || 0;
    // Бонус фракции Ремесленник: +10% к шансу улучшения
    const factionBonus = user.faction === 'crafter' ? 10 : 0;
    const finalChance = Math.min(100, chance + stoneBonus + factionBonus);
    const actualCost = Math.max(1, Math.floor(money_cost / 4));

    if (user.money < actualCost) {
        return res.status(400).json({ error: `Недостаточно денег. Требуется ${actualCost}` });
    }

    let newInventory = [...inventory];

    // Списываем камень
    if (stone.count > 1) {
        newInventory[stoneIndex] = { ...stone, count: stone.count - 1 };
    } else {
        newInventory.splice(stoneIndex, 1);
    }

    const newMoney = user.money - actualCost;

    const success = Math.random() * 100 < finalChance;

    if (success) {
        // Находим предмет в новом инвентаре (индекс мог измениться после удаления камня)
        const itemIdx = newInventory.findIndex((i: any) => i.id === itemSlot.id && !isCraftItem(i));
        if (itemIdx === -1) {
            return res.status(500).json({ error: 'Внутренняя ошибка: предмет не найден после списания камня' });
        }
        newInventory[itemIdx] = { ...newInventory[itemIdx], upgradeLevel: targetLevel };

        // Рейтинг за заточку (+7 = +5 ELO, +10 = +50 ELO)
        let ratingBonus = 0;
        if (targetLevel === 7) ratingBonus = 5;
        else if (targetLevel === 10) ratingBonus = 50;
        if (ratingBonus > 0) {
            const newElo = Math.max(100, (user.elo || 1000) + ratingBonus);
            await db.run('UPDATE users SET money = ?, inventory = ?, elo = ?, pveRating = pveRating + ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1 WHERE id = ?',
                [newMoney, JSON.stringify(newInventory), newElo, ratingBonus, userId]);
            checkAchievement(userId, 'craft').catch(() => {});
            addToTreasury(Math.floor(actualCost * 0.22), 'craft_upgrade').catch(() => {});
            const u = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
            if (u?.guildId) { updateGuildQuestProgress(u.guildId, 'craft').catch(e => console.error('guildQuest craft:', e.message)); }
            markDirty(userId, 'quests');
            // Чат-сообщение об улучшении >= +7
            if (targetLevel >= 7) {
                const itemName = itemToUpgrade.name || 'Предмет';
                const msgId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
                const chatMsg = { id: msgId, senderId: 0, senderName: 'Глашатай', targetId: null,
                    content: `⚒️ ${user.username} улучшил ${itemName} до +${targetLevel}!`,
                    createdAt: new Date().toISOString() };
                db.run('INSERT INTO chat_messages (id, senderId, targetId, content) VALUES (?, 0, NULL, ?)',
                    [msgId, chatMsg.content]).catch(() => {});
                broadcast('message', { message: chatMsg });
            }
            return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, eloAdded: ratingBonus, message: `Предмет улучшен до +${targetLevel}${ratingBonus > 0 ? ` (+${ratingBonus} рейтинга)` : ''}` });
        }

        await db.run('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1 WHERE id = ?', [JSON.stringify(newInventory), newMoney, userId]);
        checkAchievement(userId, 'craft').catch(() => {});
        addToTreasury(Math.floor(actualCost * 0.22), 'craft_upgrade').catch(() => {});
        const u = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
        if (u?.guildId) { updateGuildQuestProgress(u.guildId, 'craft').catch(e => console.error('guildQuest craft:', e.message)); }
        markDirty(userId, 'quests');
        // Чат-сообщение об улучшении >= +7
        if (targetLevel >= 7) {
            const itemName = itemToUpgrade.name || 'Предмет';
            const msgId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
            const chatMsg = { id: msgId, senderId: 0, senderName: 'Глашатай', targetId: null,
                content: `⚒️ ${user.username} улучшил ${itemName} до +${targetLevel}!`,
                createdAt: new Date().toISOString() };
            db.run('INSERT INTO chat_messages (id, senderId, targetId, content) VALUES (?, 0, NULL, ?)',
                [msgId, chatMsg.content]).catch(() => {});
            broadcast('message', { message: chatMsg });
        }
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, message: `Предмет улучшен до +${targetLevel}` });
    } else {
        // Неудача
        // Предмет ломается при попытке улучшить до +7 или выше
        if (targetLevel >= 7) {
            const itemIdx = newInventory.findIndex((i: any) => i.id === itemSlot.id && !isCraftItem(i));
            if (itemIdx !== -1) {
                const destroyedItem = newInventory[itemIdx];
                const rarityId = destroyedItem.rarity_id || 0;

                const craftItem = await db.one(`
            SELECT c.id, c.name, c.rarity_id, c.type, c.image,
                   r.display_name as rarity_display, r.color as rarity_color
            FROM craft_items c
            JOIN rarities r ON c.rarity_id = r.id
            WHERE c.rarity_id = ? AND c.type = 'craft'
          `, [rarityId]) as any;

                if (craftItem) {
                    const existingCraft = newInventory.find((i: any) => isCraftItem(i) && i.id === craftItem.id);
                    if (existingCraft) {
                        existingCraft.count += 1;
                    } else {
                        newInventory.push({
                            type: 'craft_item',
                            id: craftItem.id,
                            name: craftItem.name,
                            rarity_id: craftItem.rarity_id,
                            rarity_display: craftItem.rarity_display,
                            rarity_color: craftItem.rarity_color,
                            count: 1,
                            itemType: craftItem.type || 'craft',
                            image: craftItem.image || null,
                        });
                    }
                }
                newInventory.splice(itemIdx, 1);
            }

            await db.run('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?', [JSON.stringify(newInventory), newMoney, userId]);
            addToTreasury(Math.floor(actualCost * 0.22), 'craft_upgrade_fail').catch(() => {});
            // Чат-сообщение о поломке >= +7
            const destroyedItemName = itemToUpgrade.name || 'Предмет';
            const brokenMsgId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
            const brokenChatMsg = { id: brokenMsgId, senderId: 0, senderName: 'Глашатай', targetId: null,
                content: `💥 ${user.username} сломал ${destroyedItemName} (+${currentLevel}) при улучшении!`,
                createdAt: new Date().toISOString() };
                db.run('INSERT INTO chat_messages (id, senderId, targetId, content) VALUES (?, 0, NULL, ?)',
                    [brokenMsgId, brokenChatMsg.content]).catch(() => {});
                broadcast('message', { message: brokenChatMsg });
                return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача! Предмет разрушен.' });
        } else {
            // До +7 — просто неудача, предмет остаётся, камень и деньги списаны
            await db.run('UPDATE users SET inventory = ?, money = ? WHERE id = ?', [JSON.stringify(newInventory), newMoney, userId]);
            addToTreasury(Math.floor(actualCost * 0.22), 'craft_upgrade_fail').catch(() => {});
            return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача! Предмет не улучшен.' });
        }
    }
});

// Разобрать камень улучшения на материал
router.post('/craft/disassemble', async (req, res) => {
    const userId = req.userId;
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Укажите itemId' });

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inventory: any[] = JSON.parse(user.inventory || '[]');
    const stoneIndex = inventory.findIndex((i: any) =>
        isCraftItem(i) && String(i.id) === String(itemId) && i.itemType === 'upgrade'
    );
    if (stoneIndex === -1) return res.status(400).json({ error: 'Руна улучшения не найдена' });

    const stone = inventory[stoneIndex];
    const rarityId = stone.rarity_id || 0;

    // Найти материал той же редкости (type = 'craft')
    const material = await db.one(`
        SELECT c.id, c.name, c.rarity_id, c.type, c.image,
               r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.rarity_id = ? AND c.type = 'craft'
    `, [rarityId]) as any;

    if (!material) return res.status(400).json({ error: 'Нет материала такой редкости' });

    // Удаляем/уменьшаем камень
    if (stone.count > 1) {
        inventory[stoneIndex] = { ...stone, count: stone.count - 1 };
    } else {
        inventory.splice(stoneIndex, 1);
    }

    // Добавляем материал
    const existing = inventory.find((i: any) => isCraftItem(i) && i.id === material.id);
    if (existing) {
        existing.count += 1;
    } else {
        inventory.push({
            type: 'craft_item',
            id: material.id,
            name: material.name,
            rarity_id: material.rarity_id,
            rarity_display: material.rarity_display,
            rarity_color: material.rarity_color,
            count: 1,
            itemType: material.type || 'craft',
            image: material.image || null,
        });
    }

    await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
    res.json({ success: true, message: `Камень разобран в ${material.name}` });
});

// Проклятие предмета (Soul Crystal)
const CURSE_RANKS = [
    { rank: 1, name: 'I', color: '#22c55e', min: 10, max: 20, weight: 160 },
    { rank: 2, name: 'II', color: '#3b82f6', min: 20, max: 30, weight: 24 },
    { rank: 3, name: 'III', color: '#a855f7', min: 30, max: 40, weight: 12 },
    { rank: 4, name: 'IV', color: '#f97316', min: 40, max: 50, weight: 3 },
    { rank: 5, name: 'V', color: '#ef4444', min: 50, max: 60, weight: 1 },
];
const CURSE_STATS: Record<string, string> = { s: 'Сила', a: 'Ловкость', d: 'Защита', m: 'Мастерство' };
const CURSE_COST = 100000;

function rollCurse() {
    const totalWeight = CURSE_RANKS.reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * totalWeight;
    let rank = CURSE_RANKS[0]!;
    for (const r of CURSE_RANKS) {
        roll -= r.weight;
        if (roll <= 0) { rank = r; break; }
    }
    const stats = ['s', 'a', 'd', 'm'] as const;
    const stat = stats[Math.floor(Math.random() * 4)]!;
    const value = Math.floor(Math.random() * (rank.max - rank.min + 1)) + rank.min;
    return { rank: rank.rank, name: rank.name, color: rank.color, stat, value };
}

// Проклятие предмета — списание ресурсов + превью результата
router.post('/craft/curse', async (req, res) => {
    const userId = req.userId;
    const { itemId, crystalId } = req.body;
    if (!itemId || !crystalId) return res.status(400).json({ error: 'Укажите itemId и crystalId' });

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < CURSE_COST) return res.status(400).json({ error: `Недостаточно серебра. Нужно ${CURSE_COST.toLocaleString()}` });

    const inventory: any[] = JSON.parse(user.inventory || '[]');
    const item = inventory.find((i: any) => i.id === itemId && !isCraftItem(i));
    if (!item) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });

    const crystalIdx = inventory.findIndex((i: any) => isCraftItem(i) && i.id === crystalId && i.itemType === 'soul_crystal');
    if (crystalIdx === -1) return res.status(400).json({ error: 'Кристалл душ не найден в инвентаре' });

    // Списываем кристалл и деньги
    const crystal = inventory[crystalIdx];
    if (crystal.count > 1) {
        inventory[crystalIdx] = { ...crystal, count: crystal.count - 1 };
    } else {
        inventory.splice(crystalIdx, 1);
    }
    const newMoney = user.money - CURSE_COST;

    const oldCurse = item.curseStat ? {
        stat: item.curseStat, value: item.curseValue, rank: item.curseRank,
        name: item.curseName, color: item.curseColor,
        statName: (CURSE_STATS as Record<string, string>)[item.curseStat] || item.curseStat,
    } : null;

    const curse = rollCurse();
    const statName = (CURSE_STATS as Record<string, string>)[curse.stat] || curse.stat;

    await db.run('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1 WHERE id = ?',
        [JSON.stringify(inventory), newMoney, userId]);
    checkAchievement(userId, 'craft').catch(() => {});

    res.json({
        oldCurse,
        newCurse: { stat: curse.stat, statName, value: curse.value, rank: curse.rank, name: curse.name, color: curse.color },
        needsConfirm: !!oldCurse,
    });
});

// Применить проклятие (ресурсы уже списаны на /craft/curse)
router.post('/craft/curse/apply', async (req, res) => {
    const userId = req.userId;
    const { itemId, curse: curseData, keepOld } = req.body;

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inventory: any[] = JSON.parse(user.inventory || '[]');

    const itemIdx = inventory.findIndex((i: any) => i.id === itemId && !isCraftItem(i));
    if (itemIdx === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });

    const item = { ...inventory[itemIdx] };

    // Применяем проклятие только если не keepOld
    if (!keepOld && curseData) {
        item.curseStat = curseData.stat;
        item.curseValue = curseData.value;
        item.curseRank = curseData.rank;
        item.curseName = curseData.name;
        item.curseColor = curseData.color;
    }

    inventory[itemIdx] = item;

    await db.run('UPDATE users SET inventory = ? WHERE id = ?',
        [JSON.stringify(inventory), userId]);
    checkAchievement(userId, 'craft').catch(() => {});
    markDirty(userId, 'quests');

    const message = keepOld
        ? 'Проклятие оставлено без изменений.'
        : `Предмет проклят! +${curseData.value} к ${(CURSE_STATS as Record<string, string>)[curseData.stat] || curseData.stat} (ранг ${curseData.name})`;

    res.json({
        success: true,
        inventory,
        curse: keepOld ? null : curseData,
        message,
    });
});

export default router;
