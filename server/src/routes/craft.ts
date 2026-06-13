import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

// Все маршруты крафта требуют полный доступ
// router.use('/craft', requireFullAccess); // отключено для гостей

function isCraftItem(item: any): boolean {
    return item?.type === 'material' || item?.type === 'craft_item';
}

// Получить все рецепты (для игрока)
router.get('/craft/recipes', async (req, res) => {
    const recipes = await db.prepare('SELECT * FROM craft_recipes ORDER BY id').all() as any[];
    for (const recipe of recipes) {
        recipe.ingredients = await db.prepare(`
      SELECT ci.id as craft_item_id, ci.name, ci.rarity_id, ci.type as itemType, ci.image, cri.quantity,
             r.display_name as rarity_display, r.color as rarity_color
      FROM craft_recipe_ingredients cri
      JOIN craft_items ci ON ci.id = cri.craft_item_id
      JOIN rarities r ON ci.rarity_id = r.id
      WHERE cri.recipe_id = ?
    `).all(recipe.id);

        if (recipe.result_type === 'item') {
            recipe.result = await db.prepare(`
        SELECT i.id, i.name, i.slot, i.rarity_id, i.image,
               r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        WHERE i.id = ?
      `).get(recipe.result_id) || null;
        } else if (recipe.result_type === 'random_item') {
            // result_id = rarity_id, показываем инфо о редкости
            recipe.result = db.prepare(
                'SELECT id as rarity_id, display_name as rarity_display, color as rarity_color, name FROM rarities WHERE id = ?'
            ).get(recipe.result_id) || null;
            if (recipe.result) recipe.result.name = `Случайный предмет (${recipe.result.rarity_display})`;
        } else if (recipe.result_type === 'craft_item') {
            recipe.result = await db.prepare(`
        SELECT c.id, c.name, c.rarity_id, c.image, c.type as itemType,
               r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.id = ?
      `).get(recipe.result_id) || null;
        } else {
            recipe.result = null;
        }

        // Категория
        recipe.category = await db.prepare('SELECT * FROM craft_recipe_categories WHERE id = ?').get(recipe.category_id) || null;
    }
    res.json(recipes);
});

// Выполнить крафт по рецепту
router.post('/craft/execute', async (req, res) => {
    const userId = req.userId;
    const { recipe_id } = req.body;

    if (!recipe_id) return res.status(400).json({ error: 'recipe_id required' });

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recipe = await db.prepare('SELECT * FROM craft_recipes WHERE id = ?').get(Number(recipe_id)) as any;
    if (!recipe) return res.status(400).json({ error: 'Рецепт не найден' });

    const ingredients = await db.prepare(`
    SELECT ci.id, ci.name, ci.rarity_id, ci.type as itemType, cri.quantity,
           r.display_name as rarity_display, r.color as rarity_color
    FROM craft_recipe_ingredients cri
    JOIN craft_items ci ON ci.id = cri.craft_item_id
    JOIN rarities r ON ci.rarity_id = r.id
    WHERE cri.recipe_id = ?
  `).all(recipe.id) as any[];

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
    let newInventory = inventory.map((item: any) => {
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
    const chance = recipe.success_chance ?? 100;
    const success = Math.random() * 100 < chance;

    if (success) {
        if (recipe.result_type === 'item') {
            const resultItem = await db.prepare(`
        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        WHERE i.id = ?
      `).get(recipe.result_id) as any;
            if (!resultItem) return res.status(500).json({ error: 'Результирующий предмет не найден' });
            newInventory.push({
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
            });
        } else if (recipe.result_type === 'random_item') {
            // Случайный предмет указанной редкости (result_id = rarity_id)
            const rarityId = recipe.result_id;
            const randomItem = await db.prepare(`
                SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
                FROM items i
                JOIN rarities r ON i.rarity_id = r.id
                WHERE i.rarity_id = ?
                ORDER BY RANDOM() LIMIT 1
            `).get(rarityId) as any;
            if (!randomItem) return res.status(500).json({ error: 'Нет предметов такой редкости' });
            newInventory.push({
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
            });
        } else if (recipe.result_type === 'craft_item') {
            const resultCraftItem = await db.prepare(`
        SELECT c.*, r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.id = ?
      `).get(recipe.result_id) as any;
            if (!resultCraftItem) return res.status(500).json({ error: 'Результирующий ресурс не найден' });
            const existing = newInventory.find((i: any) => isCraftItem(i) && String(i.id) === String(recipe.result_id));
            if (existing) {
                existing.count += 1;
            } else {
                newInventory.push({
                    type: 'craft_item',
                    id: resultCraftItem.id,
                    name: resultCraftItem.name,
                    rarity_id: resultCraftItem.rarity_id,
                    rarity_display: resultCraftItem.rarity_display,
                    rarity_color: resultCraftItem.rarity_color,
                    count: 1,
                    itemType: resultCraftItem.type || 'craft',
                    image: resultCraftItem.image || null,
                });
            }
        }

        await db.prepare('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftCreated = craftCreated + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, message: 'Предмет создан!' });
    } else {
        await db.prepare('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача, предмет разрушен' });
    }
});

// Получить информацию об улучшении (шанс и стоимость) для конкретного уровня и редкости
router.get('/craft/upgrade-info/:level/:rarity', async (req, res) => {
    const level = Number(req.params.level);
    const rarity = Number(req.params.rarity);
    const data = await db.prepare('SELECT chance, money_cost FROM upgrade_chances WHERE level = ? AND rarity_id = ?').get(level, rarity) as any;
    if (!data) return res.status(404).json({ error: 'Данные об уровне не найдены' });
    res.json(data);
});

// Улучшение предмета
router.post('/craft/upgrade', async (req, res) => {
    const userId = req.userId;
    const { slots } = req.body;

    if (!Array.isArray(slots) || slots.length !== 2) {
        return res.status(400).json({ error: 'Нужно ровно два слота: предмет и камень усиления' });
    }

    const [itemSlot, stoneSlot] = slots;

    if (!itemSlot || isCraftItem(itemSlot) || !stoneSlot || !isCraftItem(stoneSlot) || stoneSlot.itemType !== 'upgrade') {
        return res.status(400).json({ error: 'Положите предмет и камень усиления того же качества' });
    }

    if (itemSlot.rarity_id !== stoneSlot.rarity_id) {
        return res.status(400).json({ error: 'Редкость камня должна совпадать с редкостью предмета' });
    }

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    let inventory: any[] = JSON.parse(user.inventory || '[]');

    const itemIndex = inventory.findIndex((i: any) => i.id === itemSlot.id && !isCraftItem(i));
    if (itemIndex === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });

    const itemToUpgrade = inventory[itemIndex];
    const currentLevel = itemToUpgrade.upgradeLevel || 0;
    const targetLevel = currentLevel + 1;

    const stoneIndex = inventory.findIndex((i: any) => isCraftItem(i) && i.id === stoneSlot.id && i.itemType === 'upgrade');
    if (stoneIndex === -1) return res.status(400).json({ error: 'Камень усиления не найден в инвентаре' });

    const stone = inventory[stoneIndex];
    if (stone.count < 1) return res.status(400).json({ error: 'Недостаточно камней усиления' });

    const upgradeData = await db.prepare('SELECT chance, money_cost FROM upgrade_chances WHERE level = ? AND rarity_id = ?').get(targetLevel, stoneSlot.rarity_id) as any;
    if (!upgradeData) {
        return res.status(400).json({ error: 'Нет данных для этого уровня улучшения. Свяжитесь с администратором.' });
    }

    const { chance, money_cost } = upgradeData;

    if (user.money < money_cost) {
        return res.status(400).json({ error: `Недостаточно денег. Требуется ${money_cost}` });
    }

    let newInventory = [...inventory];

    // Списываем камень
    if (stone.count > 1) {
        newInventory[stoneIndex] = { ...stone, count: stone.count - 1 };
    } else {
        newInventory.splice(stoneIndex, 1);
    }

    const newMoney = user.money - money_cost;

    const success = Math.random() * 100 < chance;

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
            await db.prepare('UPDATE users SET money = ?, inventory = ?, elo = ?, pveRating = pveRating + ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1 WHERE id = ?').run(newMoney, JSON.stringify(newInventory), newElo, ratingBonus, userId);
            return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, eloAdded: ratingBonus, message: `Предмет улучшен до +${targetLevel}${ratingBonus > 0 ? ` (+${ratingBonus} рейтинга)` : ''}` });
        }

        await db.prepare('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, message: `Предмет улучшен до +${targetLevel}` });
    } else {
        // Неудача: предмет разрушается, выдаём материал
        const itemIdx = newInventory.findIndex((i: any) => i.id === itemSlot.id && !isCraftItem(i));
        if (itemIdx !== -1) {
            const destroyedItem = newInventory[itemIdx];
            const rarityId = destroyedItem.rarity_id || 0;

            const craftItem = await db.prepare(`
        SELECT c.id, c.name, c.rarity_id, c.type, c.image,
               r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.rarity_id = ? AND c.type = 'craft'
      `).get(rarityId) as any;

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

        await db.prepare('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача! Предмет разрушен.' });
    }
});

// Разобрать камень улучшения на материал
router.post('/craft/disassemble', async (req, res) => {
    const userId = req.userId;
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: 'Укажите itemId' });

    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inventory: any[] = JSON.parse(user.inventory || '[]');
    const stoneIndex = inventory.findIndex((i: any) =>
        isCraftItem(i) && String(i.id) === String(itemId) && i.itemType === 'upgrade'
    );
    if (stoneIndex === -1) return res.status(400).json({ error: 'Камень улучшения не найден' });

    const stone = inventory[stoneIndex];
    const rarityId = stone.rarity_id || 0;

    // Найти материал той же редкости (type = 'craft')
    const material = await db.prepare(`
        SELECT c.id, c.name, c.rarity_id, c.type, c.image,
               r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        WHERE c.rarity_id = ? AND c.type = 'craft'
    `).get(rarityId) as any;

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

    await db.prepare('UPDATE users SET inventory = ? WHERE id = ?').run(JSON.stringify(inventory), userId);
    res.json({ success: true, message: `Камень разобран в ${material.name}` });
});

export default router;