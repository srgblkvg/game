import { Router } from 'express';
import type { PoolClient } from 'pg';
import { db } from '../db/index';
import { checkAchievement } from './achievements';
import { requireFullAccess } from '../middleware/auth';
import { updateGuildQuestProgress } from './guild';
import { markDirty, broadcast } from '../events';
import { addToTreasury } from '../game/treasury';
import { applyReforge, curseMeetsTarget, decideAutoCraftResult, getAdjustedCurseRankWeights, getCraftFactionBonus, getCraftFactionBonusParts, getReforgeCost, planBatchForge, shouldApplyCurseCandidate, shouldGrantCraftExperience, type UpgradeRule } from '../game/craftOperations';

const router = Router();

// Все маршруты крафта требуют полный доступ
// router.use('/craft', requireFullAccess); // отключено для гостей

function isCraftItem(item: any): boolean {
    return item?.type === 'material' || item?.type === 'craft_item';
}

// Получить все рецепты (для игрока)
router.get('/craft/recipes', async (req, res) => {
    const user = await db.one('SELECT faction, faction_craft_count FROM users WHERE id = ?', [req.userId]) as any;
    const factionParts = getCraftFactionBonusParts(user?.faction, user?.faction_craft_count);
    const factionBonus = factionParts.totalBonus;
    const recipes = await db.query('SELECT * FROM craft_recipes ORDER BY id', []) as any[];
    for (const recipe of recipes) {
        recipe.factionBonus = factionBonus;
        recipe.factionBaseBonus = factionParts.baseBonus;
        recipe.factionExperienceBonus = factionParts.experienceBonus;
        recipe.effectiveChance = Math.min(100, Number(recipe.success_chance ?? 100) + factionBonus);
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
            const rawOptions = await db.query(`
                SELECT i.id, i.name, i.slot, i.rarity_id, i.image, i.bonuses, i.extra,
                       r.display_name as rarity_display, r.color as rarity_color
                FROM items i
                JOIN rarities r ON i.rarity_id = r.id
                WHERE i.rarity_id = ?
                  AND (i.extra IS NULL OR i.extra::text NOT LIKE '%"set"%')
                ORDER BY i.id
            `, [recipe.result_id]) as any[];
            recipe.resultOptions = rawOptions.map(option => ({
                ...option,
                bonuses: typeof option.bonuses === 'string' ? JSON.parse(option.bonuses || '{}') : (option.bonuses || {}),
                extra: typeof option.extra === 'string' ? JSON.parse(option.extra || '{}') : (option.extra || {}),
            }));
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
    const craftBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
    const chance = (recipe.success_chance ?? 100) + craftBonus;
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

        // Ремесленник: +1 опыт только если итоговый шанс (с бонусом фракции) < 80%
        const factionInc = shouldGrantCraftExperience(user.faction, chance, true) ? ', faction_craft_count = faction_craft_count + 1' : '';
        await db.run(`UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftCreated = craftCreated + 1${factionInc} WHERE id = ?`, [JSON.stringify(newInventory), newMoney, userId]);
        checkAchievement(userId, 'craft').catch(() => {});
        addToTreasury(Math.floor(recipe.money_cost * 0.22), 'craft_recipe').catch(() => {});
        const u = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
        if (u?.guildId) { updateGuildQuestProgress(u.guildId, 'craft').catch(e => console.error('guildQuest craft:', e.message)); }
        markDirty(userId, 'quests');
        // Туториал: первый крафт → шаг 3 (Арена)
        await db.run('UPDATE users SET tutorial_step = 3 WHERE id = ? AND tutorial_step = 2', [userId]);
        return res.json({ success: true, inventory: newInventory, moneyAfter: newMoney, item: craftedItem, message: 'Предмет создан!' });
    } else {
        await db.run('UPDATE users SET inventory = ?, money = ?, craftBroken = craftBroken + 1 WHERE id = ?', [JSON.stringify(newInventory), newMoney, userId]);
        addToTreasury(Math.floor(recipe.money_cost * 0.22), 'craft_recipe_fail').catch(() => {});
        return res.json({ success: false, inventory: newInventory, moneyAfter: newMoney, message: 'Неудача, предмет разрушен' });
    }
});

// Одна атомарная попытка создания (авторежим зацикливается на клиенте)
router.post('/craft/auto-attempt', async (req, res) => {
    const recipeId = Number(req.body.recipeId);
    const rawTargetIds = Array.isArray(req.body.targetItemTemplateIds)
        ? req.body.targetItemTemplateIds
        : req.body.targetItemTemplateId == null || req.body.targetItemTemplateId === ''
            ? []
            : [req.body.targetItemTemplateId];
    const targetItemTemplateIds: number[] = [...new Set<number>(rawTargetIds.map((id: any) => Number(id)))];
    if (!Number.isInteger(recipeId) || recipeId <= 0) return res.status(400).json({ error: 'recipeId required' });
    if (targetItemTemplateIds.length > 100) return res.status(400).json({ error: 'Выбрано слишком много целей' });
    if (targetItemTemplateIds.some(id => !Number.isInteger(id) || id <= 0)) {
        return res.status(400).json({ error: 'Некорректная цель создания' });
    }

    try {
        const result = await db.tx(async client => {
            const locked = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
            const user = locked.rows[0] as any;
            if (!user) throw new Error('Игрок не найден');

            const recipeResult = await client.query('SELECT * FROM craft_recipes WHERE id = $1', [recipeId]);
            const recipe = recipeResult.rows[0] as any;
            if (!recipe) throw new Error('Рецепт не найден');
            if (!['item', 'random_item', 'craft_item'].includes(recipe.result_type)) throw new Error('Неподдерживаемый результат рецепта');
            if (targetItemTemplateIds.length && recipe.result_type !== 'random_item') {
                throw new Error('Цель доступна только для случайного предмета');
            }

            const ingredientsResult = await client.query(`
                SELECT cri.craft_item_id, cri.quantity
                FROM craft_recipe_ingredients cri
                WHERE cri.recipe_id = $1
            `, [recipe.id]);
            const ingredientMap = new Map<string, number>();
            for (const ingredient of ingredientsResult.rows as any[]) {
                const id = String(ingredient.craft_item_id);
                ingredientMap.set(id, (ingredientMap.get(id) || 0) + Number(ingredient.quantity));
            }

            if (targetItemTemplateIds.length) {
                const targetResult = await client.query(`
                    SELECT i.id
                    FROM items i
                    WHERE i.id = ANY($1::int[]) AND i.rarity_id = $2
                      AND (i.extra IS NULL OR i.extra::text NOT LIKE '%"set"%')
                `, [targetItemTemplateIds, recipe.result_id]);
                if (targetResult.rows.length !== targetItemTemplateIds.length) {
                    throw new Error('Один из выбранных предметов недоступен для этого рецепта');
                }
            }

            const inventory: any[] = typeof user.inventory === 'string' ? JSON.parse(user.inventory || '[]') : (user.inventory || []);
            for (const [itemId, needed] of ingredientMap) {
                const available = inventory
                    .filter(item => isCraftItem(item) && String(item.id) === itemId)
                    .reduce((sum, item) => sum + Number(item.count || 0), 0);
                if (available < needed) throw new Error(`Недостаточно ресурса (требуется ${needed})`);
            }
            const moneyCost = Number(recipe.money_cost || 0);
            if (Number(user.money) < moneyCost) throw new Error('Недостаточно денег');

            // Любой equipment-результат потенциально займёт слот (включая совпавшую цель).
            if (recipe.result_type === 'item' || recipe.result_type === 'random_item') {
                const equipmentCount = inventory.filter(item => !isCraftItem(item)).length;
                if (equipmentCount >= Number(user.inventoryslots || user.inventorySlots || 10)) throw new Error('Инвентарь заполнен');
            }

            const newInventory = inventory.map(item => ({ ...item }));
            for (const [itemId, needed] of ingredientMap) {
                let remaining = needed;
                for (let index = newInventory.length - 1; index >= 0 && remaining > 0; index--) {
                    const item = newInventory[index];
                    if (!isCraftItem(item) || String(item.id) !== itemId) continue;
                    const used = Math.min(Number(item.count || 0), remaining);
                    remaining -= used;
                    if (Number(item.count) === used) newInventory.splice(index, 1);
                    else newInventory[index] = { ...item, count: Number(item.count) - used };
                }
            }
            const moneyAfter = Number(user.money) - moneyCost;
            // Фиксируем списание в транзакции до броска; последующие ошибки откатят его целиком.
            await client.query('UPDATE users SET inventory = $1, money = $2 WHERE id = $3',
                [JSON.stringify(newInventory), moneyAfter, req.userId]);
            const craftBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
            const effectiveChance = Number(recipe.success_chance ?? 100) + craftBonus;
            const success = Math.random() * 100 < effectiveChance;
            let item: any;
            let rolledItem: any;
            let salvaged: boolean | undefined;
            let targetMatched: boolean | undefined;

            if (success && recipe.result_type === 'craft_item') {
                const craftResult = await client.query(`
                    SELECT c.*, r.display_name as rarity_display, r.color as rarity_color
                    FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.id = $1
                `, [recipe.result_id]);
                const template = craftResult.rows[0] as any;
                if (!template) throw new Error('Результирующий ресурс не найден');
                const existing = newInventory.find(entry => isCraftItem(entry) && String(entry.id) === String(template.id));
                if (existing) existing.count = Number(existing.count || 0) + 1;
                else newInventory.push({ type: 'craft_item', id: template.id, name: template.name, rarity_id: template.rarity_id,
                    rarity_display: template.rarity_display, rarity_color: template.rarity_color, count: 1,
                    itemType: template.type || 'craft', image: template.image || null });
                item = existing ? { ...existing, count: 1 } : newInventory[newInventory.length - 1];
            } else if (success) {
                const itemResult = recipe.result_type === 'random_item'
                    ? await client.query(`
                        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
                        FROM items i JOIN rarities r ON i.rarity_id = r.id
                        WHERE i.rarity_id = $1 AND (i.extra IS NULL OR i.extra::text NOT LIKE '%"set"%')
                        ORDER BY RANDOM() LIMIT 1
                    `, [recipe.result_id])
                    : await client.query(`
                        SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
                        FROM items i JOIN rarities r ON i.rarity_id = r.id WHERE i.id = $1
                    `, [recipe.result_id]);
                const template = itemResult.rows[0] as any;
                if (!template) throw new Error(recipe.result_type === 'random_item' ? 'Нет предметов такой редкости' : 'Результирующий предмет не найден');
                rolledItem = {
                    id: Date.now() + Math.random(), templateId: template.id, name: template.name, slot: template.slot,
                    rarity_id: template.rarity_id, rarity_display: template.rarity_display, rarity_color: template.rarity_color,
                    bonuses: typeof template.bonuses === 'string' ? JSON.parse(template.bonuses || '{}') : (template.bonuses || {}),
                    extra: typeof template.extra === 'string' ? JSON.parse(template.extra || '{}') : (template.extra || {}),
                    image: template.image || null, upgradeLevel: 0,
                };
                const decision = recipe.result_type === 'random_item'
                    ? decideAutoCraftResult(targetItemTemplateIds, template.id)
                    : { targetMatched: undefined, salvaged: false };
                targetMatched = decision.targetMatched;
                salvaged = decision.salvaged;
                if (salvaged) {
                    const salvageResult = await client.query(`
                        SELECT c.id, c.name, c.rarity_id, c.type, c.image,
                               r.display_name as rarity_display, r.color as rarity_color
                        FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
                        WHERE c.rarity_id = $1 AND c.type = 'craft' ORDER BY c.id LIMIT 1
                    `, [template.rarity_id]);
                    const material = salvageResult.rows[0] as any;
                    if (!material) throw new Error('Материал для разбора не найден');
                    const existing = newInventory.find(entry => isCraftItem(entry) && String(entry.id) === String(material.id));
                    if (existing) existing.count = Number(existing.count || 0) + 1;
                    else newInventory.push({ type: 'craft_item', id: material.id, name: material.name, rarity_id: material.rarity_id,
                        rarity_display: material.rarity_display, rarity_color: material.rarity_color, count: 1,
                        itemType: material.type || 'craft', image: material.image || null });
                } else {
                    item = rolledItem;
                    newInventory.push(item);
                }
            }

            if (success) {
                const factionInc = shouldGrantCraftExperience(user.faction, effectiveChance, success) ? 1 : 0;
                await client.query(`
                    UPDATE users SET inventory = $1, money = $2, craftCount = craftCount + 1,
                        craftCreated = craftCreated + 1, faction_craft_count = faction_craft_count + $3
                    WHERE id = $4
                `, [JSON.stringify(newInventory), moneyAfter, factionInc, req.userId]);
                await client.query('UPDATE users SET tutorial_step = 3 WHERE id = $1 AND tutorial_step = 2', [req.userId]);
            } else {
                await client.query('UPDATE users SET inventory = $1, money = $2, craftBroken = craftBroken + 1 WHERE id = $3',
                    [JSON.stringify(newInventory), moneyAfter, req.userId]);
            }
            return { success, inventory: newInventory, moneyAfter, effectiveChance, item, rolledItem, salvaged, targetMatched,
                guildId: user.guildid || user.guildId, moneyCost,
                message: success ? (salvaged ? 'Предмет не совпал с целью и разобран' : 'Предмет создан!') : 'Неудача, предмет разрушен' };
        });

        addToTreasury(Math.floor(result.moneyCost * 0.22), result.success ? 'craft_recipe' : 'craft_recipe_fail').catch(() => {});
        if (result.success) {
            checkAchievement(req.userId, 'craft').catch(() => {});
            if (result.guildId) updateGuildQuestProgress(result.guildId, 'craft').catch(e => console.error('guildQuest craft:', e.message));
            markDirty(req.userId, 'quests');
        }
        const { guildId: _guildId, moneyCost: _moneyCost, ...response } = result;
        return res.json(response);
    } catch (error: any) {
        const message = error?.message || 'Ошибка создания';
        return res.status(message === 'Игрок не найден' ? 404 : 400).json({ error: message });
    }
});

// Получить информацию об улучшении (шанс и стоимость) для конкретного уровня и редкости
router.get('/craft/upgrade-info/:level/:rarity', async (req, res) => {
    const level = Number(req.params.level);
    const rarity = Number(req.params.rarity);
    const userId = req.userId;
    const data = await db.one('SELECT chance, money_cost FROM upgrade_chances WHERE level = ? AND rarity_id = ?', [level, rarity]) as any;
    if (!data) return res.status(404).json({ error: 'Данные об уровне не найдены' });
    // Бонус фракции Ремесленник: +10% +1% за каждые 100 очков опыта
    const user = await db.one('SELECT faction, faction_craft_count FROM users WHERE id = ?', [userId]) as any;
    const factionParts = getCraftFactionBonusParts(user?.faction, user?.faction_craft_count);
    res.json({ chance: data.chance, factionBonus: factionParts.totalBonus,
        factionBaseBonus: factionParts.baseBonus, factionExperienceBonus: factionParts.experienceBonus,
        money_cost: Math.max(1, Math.floor(data.money_cost / 4)) });
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
    // Бонус фракции Ремесленник: +10% +1% за каждые 100 очков опыта
    const factionBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
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
            // Ремесленник: +1 опыт только если итоговый шанс < 80%
            const upgradeFactionInc = shouldGrantCraftExperience(user.faction, finalChance, success) ? ', faction_craft_count = faction_craft_count + 1' : '';
            await db.run(`UPDATE users SET money = ?, inventory = ?, elo = ?, pveRating = pveRating + ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1${upgradeFactionInc} WHERE id = ?`,
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

        // Ремесленник: +1 опыт только если итоговый шанс < 80%
        const upgradeFactionInc2 = shouldGrantCraftExperience(user.faction, finalChance, success) ? ', faction_craft_count = faction_craft_count + 1' : '';
        await db.run(`UPDATE users SET inventory = ?, money = ?, craftCount = craftCount + 1, craftUpgraded = craftUpgraded + 1${upgradeFactionInc2} WHERE id = ?`, [JSON.stringify(newInventory), newMoney, userId]);
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

function getCurseRankChances(factionBonus: number) {
    const weights = getAdjustedCurseRankWeights(CURSE_RANKS.map(rank => rank.weight), factionBonus);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    return CURSE_RANKS.map((rank, index) => ({
        rank: rank.rank, name: rank.name, color: rank.color,
        chance: totalWeight > 0 ? weights[index]! / totalWeight * 100 : 0,
    }));
}

function rollCurse(factionBonus = 0) {
    const weights = getAdjustedCurseRankWeights(CURSE_RANKS.map(rank => rank.weight), factionBonus);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * totalWeight;
    let rank = CURSE_RANKS[0]!;
    for (let index = 0; index < CURSE_RANKS.length; index += 1) {
        const r = CURSE_RANKS[index]!;
        roll -= weights[index]!;
        if (roll <= 0) { rank = r; break; }
    }
    const stats = ['s', 'a', 'd', 'm'] as const;
    const stat = stats[Math.floor(Math.random() * 4)]!;
    const value = Math.floor(Math.random() * (rank.max - rank.min + 1)) + rank.min;
    return { rank: rank.rank, name: rank.name, color: rank.color, stat, value };
}

router.get('/craft/curse-info', async (req, res) => {
    const user = await db.one('SELECT faction, faction_craft_count FROM users WHERE id = ?', [req.userId]) as any;
    const factionParts = getCraftFactionBonusParts(user?.faction, user?.faction_craft_count);
    res.json({ factionBonus: factionParts.totalBonus, factionBaseBonus: factionParts.baseBonus,
        factionExperienceBonus: factionParts.experienceBonus,
        ranks: getCurseRankChances(factionParts.totalBonus) });
});

// Одна атомарная попытка целевого проклятия: списание и сохранение результата в одной транзакции.
router.post('/craft/curse-target-attempt', async (req, res) => {
    const { itemId, crystalId, targetStat, minimumRank, random } = req.body;
    const normalizedStat = targetStat || null;
    const normalizedRank = minimumRank == null || minimumRank === '' ? null : Number(minimumRank);
    if (!random && ((normalizedStat !== null && !['s', 'a', 'd', 'm'].includes(normalizedStat))
        || (normalizedRank !== null && (!Number.isInteger(normalizedRank) || normalizedRank < 1 || normalizedRank > 5)))) {
        return res.status(400).json({ error: 'Укажите характеристику и ранг проклятия' });
    }
    try {
        const result = await db.tx(async client => {
            const locked = await client.query('SELECT inventory, money, faction, faction_craft_count FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
            const user = locked.rows[0];
            if (!user) throw new Error('Игрок не найден');
            if (Number(user.money) < CURSE_COST) throw new Error(`Недостаточно серебра. Нужно ${CURSE_COST.toLocaleString()}`);
            const inventory: any[] = JSON.parse(user.inventory || '[]');
            const itemIndex = inventory.findIndex(item => !isCraftItem(item) && String(item.id) === String(itemId));
            if (itemIndex === -1) throw new Error('Предмет не найден в инвентаре');
            if (inventory[itemIndex].pendingCurse) throw new Error('Сначала выберите результат предыдущего проклятия');
            const crystalIndex = inventory.findIndex(item => isCraftItem(item)
                && String(item.id) === String(crystalId) && item.itemType === 'soul_crystal');
            if (crystalIndex === -1) throw new Error('Кристалл душ не найден в инвентаре');

            const factionBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
            const curse = rollCurse(factionBonus);
            const matched = random || curseMeetsTarget(curse, normalizedStat, normalizedRank);
            const item = { ...inventory[itemIndex] };
            const currentCurse = item.curseStat
                ? { stat: String(item.curseStat), rank: Number(item.curseRank || 1) }
                : null;
            const applied = random || shouldApplyCurseCandidate(currentCurse, curse, normalizedStat, normalizedRank);
            if (applied) {
                item.curseStat = curse.stat;
                item.curseValue = curse.value;
                item.curseRank = curse.rank;
                item.curseName = curse.name;
                item.curseColor = curse.color;
                inventory[itemIndex] = item;
            }
            const crystal = inventory[crystalIndex];
            if (Number(crystal.count) > 1) inventory[crystalIndex] = { ...crystal, count: Number(crystal.count) - 1 };
            else inventory.splice(crystalIndex, 1);
            const moneyAfter = Number(user.money) - CURSE_COST;
            await client.query(
                'UPDATE users SET inventory = $1, money = $2, craftcount = craftcount + 1 WHERE id = $3',
                [JSON.stringify(inventory), moneyAfter, req.userId]
            );
            const statName = CURSE_STATS[curse.stat] || curse.stat;
            return {
                inventory, moneyAfter, matched, applied,
                curse: { stat: curse.stat, statName, value: curse.value, rank: curse.rank, name: curse.name, color: curse.color },
            };
        });
        checkAchievement(req.userId!, 'craft').catch(() => {});
        markDirty(req.userId!, 'quests');
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'Ошибка проклятия' });
    }
});

// Проклятие предмета — списание ресурсов + превью результата
router.post('/craft/curse', async (req, res) => {
    const userId = req.userId;
    const { itemId, crystalId } = req.body;
    if (!itemId || !crystalId) return res.status(400).json({ error: 'Укажите itemId и crystalId' });
    try {
        const result = await db.tx(async client => {
            const locked = await client.query('SELECT inventory, money, faction, faction_craft_count FROM users WHERE id = $1 FOR UPDATE', [userId]);
            const user = locked.rows[0];
            if (!user) throw new Error('Игрок не найден');
            if (Number(user.money) < CURSE_COST) throw new Error(`Недостаточно серебра. Нужно ${CURSE_COST.toLocaleString()}`);

            const inventory: any[] = JSON.parse(user.inventory || '[]');
            const itemIdx = inventory.findIndex((i: any) => String(i.id) === String(itemId) && !isCraftItem(i));
            if (itemIdx === -1) throw new Error('Предмет не найден в инвентаре');
            const item = { ...inventory[itemIdx] };
            if (item.pendingCurse) throw new Error('Сначала выберите результат предыдущего проклятия');

            const crystalIdx = inventory.findIndex((i: any) => isCraftItem(i)
                && String(i.id) === String(crystalId) && i.itemType === 'soul_crystal');
            if (crystalIdx === -1) throw new Error('Кристалл душ не найден в инвентаре');

            const oldCurse = item.curseStat ? {
                stat: item.curseStat, value: item.curseValue, rank: item.curseRank,
                name: item.curseName, color: item.curseColor,
                statName: (CURSE_STATS as Record<string, string>)[item.curseStat] || item.curseStat,
            } : null;
            const factionBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
            const curse = rollCurse(factionBonus);
            const statName = (CURSE_STATS as Record<string, string>)[curse.stat] || curse.stat;
            if (oldCurse) item.pendingCurse = curse;
            else {
                item.curseStat = curse.stat;
                item.curseValue = curse.value;
                item.curseRank = curse.rank;
                item.curseName = curse.name;
                item.curseColor = curse.color;
            }

            const crystal = inventory[crystalIdx];
            if (Number(crystal.count) > 1) inventory[crystalIdx] = { ...crystal, count: Number(crystal.count) - 1 };
            else inventory.splice(crystalIdx, 1);
            const updatedItemIdx = inventory.findIndex((i: any) => String(i.id) === String(itemId) && !isCraftItem(i));
            if (updatedItemIdx === -1) throw new Error('Предмет потерян при обработке инвентаря');
            inventory[updatedItemIdx] = item;

            const moneyAfter = Number(user.money) - CURSE_COST;
            await client.query(
                'UPDATE users SET inventory = $1, money = $2, craftcount = craftcount + 1 WHERE id = $3',
                [JSON.stringify(inventory), moneyAfter, userId]
            );
            return {
                oldCurse,
                newCurse: { stat: curse.stat, statName, value: curse.value, rank: curse.rank, name: curse.name, color: curse.color },
                needsConfirm: !!oldCurse,
                inventory,
                moneyAfter,
            };
        });
        checkAchievement(userId!, 'craft').catch(() => {});
        markDirty(userId!, 'quests');
        return res.json(result);
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'Ошибка проклятия' });
    }
});

// Применить проклятие (ресурсы уже списаны на /craft/curse)
router.post('/craft/curse/apply', async (req, res) => {
    const userId = req.userId;
    const { itemId, keepOld } = req.body;

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const inventory: any[] = JSON.parse(user.inventory || '[]');

    const itemIdx = inventory.findIndex((i: any) => String(i.id) === String(itemId) && !isCraftItem(i));
    if (itemIdx === -1) return res.status(400).json({ error: 'Предмет не найден в инвентаре' });

    const item = { ...inventory[itemIdx] };
    const curseData = item.pendingCurse;
    if (!curseData) return res.status(400).json({ error: 'Нет ожидающего результата проклятия' });

    // Применяем ожидающее проклятие только если не keepOld
    if (!keepOld && curseData) {
        item.curseStat = curseData.stat;
        item.curseValue = curseData.value;
        item.curseRank = curseData.rank;
        item.curseName = curseData.name;
        item.curseColor = curseData.color;
    }
    delete item.pendingCurse;

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

// Предпросмотр стоимости перековки
router.get('/craft/reforge-info/:itemId', async (req, res) => {
    try {
        const user = await db.one('SELECT inventory FROM users WHERE id = ?', [req.userId]) as any;
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });
        const inventory: any[] = JSON.parse(user.inventory || '[]');
        const item = inventory.find(i => !isCraftItem(i) && String(i.id) === String(req.params.itemId));
        if (!item) return res.status(404).json({ error: 'Предмет не найден в инвентаре' });
        return res.json({ cost: getReforgeCost(item), reforgeCount: Number(item.reforgeCount || 0) });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// Перековка одной базовой или дополнительной характеристики
router.post('/craft/reforge', async (req, res) => {
    const { itemId, fromStat, toStat } = req.body;
    if (!['string', 'number'].includes(typeof itemId) || String(itemId).length > 64
        || typeof fromStat !== 'string' || typeof toStat !== 'string') {
        return res.status(400).json({ error: 'Укажите предмет и характеристики перековки' });
    }
    try {
        const result = await db.tx(async client => {
            const locked = await client.query('SELECT inventory, money, faction, faction_craft_count FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
            const user = locked.rows[0];
            if (!user) throw new Error('Игрок не найден');
            const inventory: any[] = JSON.parse(user.inventory || '[]');
            const itemIndex = inventory.findIndex(i => !isCraftItem(i) && String(i.id) === String(itemId));
            if (itemIndex === -1) throw new Error('Предмет не найден в инвентаре');
            if (inventory[itemIndex].locked) throw new Error('Предмет заблокирован. Разблокируйте его в инвентаре.');
            const cost = getReforgeCost(inventory[itemIndex]);
            if (Number(user.money) < cost) throw new Error(`Недостаточно серебра. Требуется ${cost}`);
            inventory[itemIndex] = applyReforge(inventory[itemIndex], fromStat, toStat);
            await client.query(
                'UPDATE users SET inventory = $1, money = money - $2, craftcount = craftcount + 1 WHERE id = $3',
                [JSON.stringify(inventory), cost, req.userId]
            );
            return { inventory, moneyAfter: Number(user.money) - cost, item: inventory[itemIndex], cost };
        });
        addToTreasury(Math.floor(result.cost * 0.22), 'craft_reforge').catch(() => {});
        checkAchievement(req.userId!, 'craft').catch(() => {});
        markDirty(req.userId!, 'quests');
        const guildUser = await db.one('SELECT guildId FROM users WHERE id = ?', [req.userId]) as any;
        if (guildUser?.guildId) updateGuildQuestProgress(guildUser.guildId, 'craft').catch(() => {});
        return res.json({ success: true, ...result, message: 'Характеристика перекована' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'Ошибка перековки' });
    }
});

async function loadBatchForgePlan(inventory: any[], selections: any[], client?: PoolClient) {
    if (!Array.isArray(selections) || selections.length === 0 || selections.length > 20) {
        throw new Error('Выберите от 1 до 20 предметов');
    }
    const selected = selections.map(selection => {
        const item = inventory.find(i => !isCraftItem(i) && String(i.id) === String(selection.itemId));
        if (!item) throw new Error('Один из предметов не найден в инвентаре');
        if (item.locked) throw new Error(`${item.name || 'Предмет'} заблокирован`);
        return { item, targetLevel: Number(selection.targetLevel) };
    });
    const rows = client
        ? (await client.query('SELECT level, rarity_id, chance, money_cost FROM upgrade_chances')).rows
        : await db.query('SELECT level, rarity_id, chance, money_cost FROM upgrade_chances', []) as any[];
    const rules: UpgradeRule[] = rows.map(row => ({
        level: Number(row.level), rarityId: Number(row.rarity_id ?? row.rarityId),
        chance: Number(row.chance), moneyCost: Math.max(1, Math.floor(Number(row.money_cost ?? row.moneyCost) / 4)),
    }));
    return planBatchForge(selected, rules);
}

// Необходимый запас и шансы массового улучшения, если все попытки дойдут до цели
router.post('/craft/batch-forge/preview', async (req, res) => {
    const user = await db.one('SELECT inventory, faction, faction_craft_count FROM users WHERE id = ?', [req.userId]) as any;
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });
    try {
        const inventory = JSON.parse(user.inventory || '[]');
        const stone = inventory.find((item: any) => isCraftItem(item)
            && String(item.id) === String(req.body.stoneId) && item.itemType === 'upgrade');
        if (!stone) throw new Error('Выберите камень улучшения');
        const plan = await loadBatchForgePlan(inventory, req.body.selections);
        const stoneBonus: Record<number, number> = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20, 5: 30, 6: 50 };
        const factionBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
        const factionParts = getCraftFactionBonusParts(user.faction, user.faction_craft_count);
        const entries = plan.entries.map(entry => {
            const rules = entry.rules.map(rule => ({
                ...rule,
                finalChance: Math.min(100, rule.chance + (stoneBonus[Number(stone.rarity_id)] || 0) + factionBonus),
            }));
            const targetChance = Math.round(rules.reduce((probability, rule) => probability * rule.finalChance / 100, 1) * 1000) / 10;
            return { ...entry, rules, targetChance };
        });
        return res.json({ ...plan, entries, stoneBonus: stoneBonus[Number(stone.rarity_id)] || 0, factionBonus,
            factionBaseBonus: factionParts.baseBonus, factionExperienceBonus: factionParts.experienceBonus });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

// Массовая ковка. Для каждого предмета попытки прекращаются при первой неудаче.
router.post('/craft/batch-forge', async (req, res) => {
    const { selections, stoneId } = req.body;
    if (!stoneId) return res.status(400).json({ error: 'Выберите камень улучшения' });
    try {
        const result = await db.tx(async client => {
            const locked = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
            const user = locked.rows[0];
            if (!user) throw new Error('Игрок не найден');
            let inventory: any[] = JSON.parse(user.inventory || '[]');
            const plan = await loadBatchForgePlan(inventory, selections, client);
            const stone = inventory.find(i => isCraftItem(i) && String(i.id) === String(stoneId) && i.itemType === 'upgrade');
            if (!stone || Number(stone.count) < plan.requiredStones) {
                throw new Error(`Недостаточно камней. Требуется ${plan.requiredStones}`);
            }
            if (Number(user.money) < plan.totalCost) {
                throw new Error(`Недостаточно серебра. Максимальная стоимость ${plan.totalCost}`);
            }

            const stoneBonus: Record<number, number> = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20, 5: 30, 6: 50 };
            const factionBonus = getCraftFactionBonus(user.faction, user.faction_craft_count);
            const results: any[] = [];
            let spent = 0;
            let stonesUsed = 0;
            let successfulLevels = 0;
            let brokenCount = 0;
            let ratingBonus = 0;
            let factionProgress = 0;
            const announcements: Array<{ kind: 'upgrade' | 'broken'; itemName: string; level: number }> = [];

            for (const entry of plan.entries) {
                const selectionResult: any = { itemId: entry.itemId, attempts: [], reachedLevel: entry.currentLevel, destroyed: false };
                for (const rule of entry.rules) {
                    spent += rule.moneyCost;
                    stonesUsed += 1;
                    const chance = Math.min(100, rule.chance + (stoneBonus[Number(stone.rarity_id)] || 0) + factionBonus);
                    const success = Math.random() * 100 < chance;
                    selectionResult.attempts.push({ level: rule.level, chance, success });
                    if (success) {
                        if (shouldGrantCraftExperience(user.faction, chance, success)) factionProgress += 1;
                        const index = inventory.findIndex(i => !isCraftItem(i) && String(i.id) === entry.itemId);
                        if (index === -1) throw new Error('Предмет пропал во время ковки');
                        const itemName = inventory[index].name || 'Предмет';
                        inventory[index] = { ...inventory[index], upgradeLevel: rule.level };
                        selectionResult.reachedLevel = rule.level;
                        successfulLevels += 1;
                        if (rule.level === 7) ratingBonus += 5;
                        else if (rule.level === 10) ratingBonus += 50;
                        if (rule.level >= 7) announcements.push({ kind: 'upgrade', itemName, level: rule.level });
                        continue;
                    }
                    if (rule.level >= 7) {
                        const index = inventory.findIndex(i => !isCraftItem(i) && String(i.id) === entry.itemId);
                        if (index !== -1) {
                            const destroyed = inventory[index];
                            const materialResult = await client.query(
                                `SELECT c.id, c.name, c.rarity_id, c.type, c.image,
                                        r.display_name AS rarity_display, r.color AS rarity_color
                                 FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
                                 WHERE c.rarity_id = $1 AND c.type = 'craft' LIMIT 1`,
                                [Number(destroyed.rarity_id || 0)]
                            );
                            inventory.splice(index, 1);
                            const material = materialResult.rows[0];
                            if (material) {
                                const existing = inventory.find(i => isCraftItem(i) && String(i.id) === String(material.id));
                                if (existing) existing.count = Number(existing.count || 0) + 1;
                                else inventory.push({
                                    type: 'craft_item', id: material.id, name: material.name,
                                    rarity_id: material.rarity_id, rarity_display: material.rarity_display,
                                    rarity_color: material.rarity_color, count: 1,
                                    itemType: material.type || 'craft', image: material.image || null,
                                });
                            }
                            announcements.push({ kind: 'broken', itemName: destroyed.name || 'Предмет', level: rule.level - 1 });
                        }
                        selectionResult.destroyed = true;
                        brokenCount += 1;
                    }
                    break;
                }
                results.push(selectionResult);
            }

            const stoneIndex = inventory.findIndex(i => isCraftItem(i) && String(i.id) === String(stoneId) && i.itemType === 'upgrade');
            if (stoneIndex === -1) throw new Error('Камни не найдены после ковки');
            const remaining = Number(inventory[stoneIndex].count) - stonesUsed;
            if (remaining > 0) inventory[stoneIndex] = { ...inventory[stoneIndex], count: remaining };
            else inventory.splice(stoneIndex, 1);

            for (const announcement of announcements) {
                const msgId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
                const content = announcement.kind === 'upgrade'
                    ? `⚒️ ${user.username || 'Игрок'} улучшил ${announcement.itemName} до +${announcement.level}!`
                    : `💥 ${user.username || 'Игрок'} сломал ${announcement.itemName} (+${announcement.level}) при улучшении!`;
                await client.query(
                    'INSERT INTO chat_messages (id, senderid, targetid, content) VALUES ($1, 0, NULL, $2)',
                    [msgId, content]
                );
                (announcement as any).message = {
                    id: msgId, senderId: 0, senderName: 'Глашатай', targetId: null,
                    content, createdAt: new Date().toISOString(),
                };
            }

            await client.query(
                `UPDATE users SET inventory = $1, money = money - $2,
                 craftcount = craftcount + $3, craftupgraded = craftupgraded + $4,
                 craftbroken = craftbroken + $5, faction_craft_count = faction_craft_count + $6,
                 elo = GREATEST(100, elo + $7), pverating = pverating + $7 WHERE id = $8`,
                [JSON.stringify(inventory), spent, successfulLevels, successfulLevels, brokenCount,
                    factionProgress, ratingBonus, req.userId]
            );
            return { inventory, moneyAfter: Number(user.money) - spent, results, spent, stonesUsed, ratingBonus, announcements };
        });
        addToTreasury(Math.floor(result.spent * 0.22), 'craft_batch_forge').catch(() => {});
        checkAchievement(req.userId!, 'craft').catch(() => {});
        markDirty(req.userId!, 'quests');
        const guildUser = await db.one('SELECT guildId FROM users WHERE id = ?', [req.userId]) as any;
        if (guildUser?.guildId) updateGuildQuestProgress(guildUser.guildId, 'craft').catch(() => {});
        for (const announcement of result.announcements) {
            if ((announcement as any).message) {
                broadcast('message', { message: (announcement as any).message });
            }
        }
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(400).json({ error: error.message || 'Ошибка массовой ковки' });
    }
});

export default router;
