import { Router } from 'express';
import db from '../database';
import { requireFullAccess } from '../middleware/auth';

const router = Router();

// Все маршруты крафта требуют полный доступ
router.use('/craft', requireFullAccess);

function isCraftItem(item: any): boolean {
    return item?.type === 'material' || item?.type === 'craft_item';
}

// Получить все рецепты (для игрока)
router.get('/craft/recipes', (req, res) => {
    const recipes = db.prepare('SELECT * FROM craft_recipes ORDER BY id').all() as any[];
    for (const recipe of recipes) {
        recipe.ingredients = db.prepare(`
      SELECT ci.id as craft_item_id, ci.name, ci.rarity_id, ci.type as itemType, ci.image, cri.quantity,
             r.display_name as rarity_display, r.color as rarity_color
      FROM craft_recipe_ingredients cri
      JOIN craft_items ci ON ci.id = cri.craft_item_id
      JOIN rarities r ON ci.rarity_id = r.id
      WHERE cri.recipe_id = ?
    `).all(recipe.id);

        if (recipe.result_type === 'item') {
            recipe.result = db.prepare(`
        SELECT i.id, i.name, i.slot, i.rarity_id, i.image,
               r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        WHERE i.id = ?
      `).get(recipe.result_id) || null;
        } else if (recipe.result_type === 'craft_item') {
            recipe.result = db.prepare(`
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
        recipe.category = db.prepare('SELECT * FROM craft_recipe_categories WHERE id = ?').get(recipe.category_id) || null;
    }
    res.json(recipes);
});

// Выполнить крафт по рецепту
router.post('/craft/execute', (req: any, res) => {
    const userId = req.userId;
    const { recipe_id } = req.body;

    if (!recipe_id) return res.status(400).json({ error: 'recipe_id required' });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recipe = db.prepare('SELECT * FROM craft_recipes WHERE id = ?').get(Number(recipe_id)) as any;
    if (!recipe) return res.status(400).json({ error: 'Рецепт не найден' });

    const ingredients = db.prepare(`
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
            const resultItem = db.prepare(`
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
        } else if (recipe.result_type === 'craft_item') {
            const resultCraftItem = db.prepare(`
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

        db.prepare('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftCreated = craftCreated + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, message: 'Предмет создан!' });
    } else {
        db.prepare('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача, предмет разрушен' });
    }
});

// Получить информацию об улучшении (шанс и стоимость) для конкретного уровня
router.get('/craft/upgrade-info/:level', (req, res) => {
    const level = Number(req.params.level);
    const data = db.prepare('SELECT chance, money_cost FROM upgrade_chances WHERE level = ?').get(level) as any;
    if (!data) return res.status(404).json({ error: 'Данные об уровне не найдены' });
    res.json(data);
});

// Улучшение предмета
router.post('/craft/upgrade', (req: any, res) => {
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

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
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

    const upgradeData = db.prepare('SELECT chance, money_cost FROM upgrade_chances WHERE level = ?').get(targetLevel) as any;
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
            db.prepare('UPDATE users SET money = ?, inventory = ?, elo = ?, pveRating = pveRating + ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1 WHERE id = ?')
                .run(newMoney, JSON.stringify(newInventory), newElo, ratingBonus, userId);
            return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, eloAdded: ratingBonus, message: `Предмет улучшен до +${targetLevel}${ratingBonus > 0 ? ` (+${ratingBonus} рейтинга)` : ''}` });
        }

        db.prepare('UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, message: `Предмет улучшен до +${targetLevel}` });
    } else {
        // Неудача: предмет разрушается, выдаём материал
        const itemIdx = newInventory.findIndex((i: any) => i.id === itemSlot.id && !isCraftItem(i));
        if (itemIdx !== -1) {
            const destroyedItem = newInventory[itemIdx];
            const rarityId = destroyedItem.rarity_id || 0;

            const craftItem = db.prepare(`
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

        db.prepare('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?').run(JSON.stringify(newInventory), newMoney, userId);
        return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача! Предмет разрушен.' });
    }
});

export default router;