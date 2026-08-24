import type { PoolClient } from 'pg';
import { changeTreasuryWithClient } from './treasury';
import { getCraftFactionBonus, shouldGrantCraftExperience } from './craftOperations';

interface ExecuteCraftInput {
  userId: number;
  recipeId: number;
  random?: () => number;
  now?: () => number;
}

export interface ExecuteCraftResult {
  status: number;
  success: boolean;
  body: Record<string, unknown>;
  guildId?: number;
}

function isCraftItem(item: any): boolean {
  return item?.type === 'material' || item?.type === 'craft_item';
}

function error(status: number, message: string): ExecuteCraftResult {
  return { status, success: false, body: { error: message } };
}

export async function executeCraftWithClient(client: PoolClient, input: ExecuteCraftInput): Promise<ExecuteCraftResult> {
  const random = input.random || Math.random;
  const now = input.now || Date.now;
  await client.query('SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE');
  const user = (await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [input.userId])).rows[0] as any;
  if (!user) return error(404, 'User not found');

  const recipe = (await client.query('SELECT * FROM craft_recipes WHERE id = $1', [input.recipeId])).rows[0] as any;
  if (!recipe) return error(400, 'Рецепт не найден');
  const ingredients = (await client.query(`
    SELECT ci.id, ci.name, ci.rarity_id, ci.type as "itemType", cri.quantity,
           r.display_name as rarity_display, r.color as rarity_color
    FROM craft_recipe_ingredients cri
    JOIN craft_items ci ON ci.id = cri.craft_item_id
    JOIN rarities r ON ci.rarity_id = r.id
    WHERE cri.recipe_id = $1
  `, [recipe.id])).rows as any[];

  const inventory: any[] = JSON.parse(user.inventory || '[]');
  const ingredientMap = new Map<string, number>();
  for (const ingredient of ingredients) ingredientMap.set(String(ingredient.id), Number(ingredient.quantity));
  for (const [itemId, needed] of ingredientMap) {
    const existing = inventory.find(item => isCraftItem(item) && String(item.id) === itemId);
    if (!existing || Number(existing.count) < needed) return error(400, `Недостаточно ресурса (требуется ${needed})`);
  }
  const moneyCost = Number(recipe.money_cost || 0);
  if (Number(user.money) < moneyCost) return error(400, 'Недостаточно денег');
  if (recipe.result_type === 'item') {
    const equipmentCount = inventory.filter(item => !isCraftItem(item)).length;
    if (equipmentCount >= Number(user.inventoryslots || user.inventorySlots || 10)) return error(400, 'Инвентарь заполнен');
  }

  const remainingIngredients = new Map(ingredientMap);
  const newInventory = inventory.map(item => {
    if (!isCraftItem(item) || !remainingIngredients.has(String(item.id))) return item;
    const needed = remainingIngredients.get(String(item.id))!;
    if (Number(item.count) > needed) return { ...item, count: Number(item.count) - needed };
    remainingIngredients.delete(String(item.id));
    return null;
  }).filter(Boolean);
  const moneyAfter = Number(user.money) - moneyCost;
  const chance = Number(recipe.success_chance ?? 100) + getCraftFactionBonus(user.faction, user.faction_craft_count);
  const success = random() * 100 < chance;
  let craftedItem: any = null;

  if (success && recipe.result_type === 'item') {
    const template = (await client.query(`SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
      FROM items i JOIN rarities r ON i.rarity_id = r.id WHERE i.id = $1`, [recipe.result_id])).rows[0] as any;
    if (!template) return error(500, 'Результирующий предмет не найден');
    craftedItem = { id: now() + random(), name: template.name, slot: template.slot, rarity_id: template.rarity_id,
      rarity_display: template.rarity_display, rarity_color: template.rarity_color,
      bonuses: JSON.parse(template.bonuses || '{}'), extra: JSON.parse(template.extra || '{}'),
      image: template.image || null, upgradeLevel: 0 };
    newInventory.push(craftedItem);
  } else if (success && recipe.result_type === 'random_item') {
    const template = (await client.query(`SELECT i.*, r.display_name as rarity_display, r.color as rarity_color
      FROM items i JOIN rarities r ON i.rarity_id = r.id
      WHERE i.rarity_id = $1 AND (i.extra IS NULL OR i.extra::text NOT LIKE '%"set"%') ORDER BY RANDOM() LIMIT 1`, [recipe.result_id])).rows[0] as any;
    if (!template) return error(500, 'Нет предметов такой редкости');
    craftedItem = { id: now() + random(), name: template.name, slot: template.slot, rarity_id: template.rarity_id,
      rarity_display: template.rarity_display, rarity_color: template.rarity_color,
      bonuses: JSON.parse(template.bonuses || '{}'), extra: JSON.parse(template.extra || '{}'),
      image: template.image || null, upgradeLevel: 0 };
    newInventory.push(craftedItem);
  } else if (success && recipe.result_type === 'craft_item') {
    const template = (await client.query(`SELECT c.*, r.display_name as rarity_display, r.color as rarity_color
      FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.id = $1`, [recipe.result_id])).rows[0] as any;
    if (!template) return error(500, 'Результирующий ресурс не найден');
    const existing = newInventory.find(item => isCraftItem(item) && String(item.id) === String(recipe.result_id));
    if (existing) { existing.count = Number(existing.count) + 1; craftedItem = { ...existing, count: 1 }; }
    else {
      craftedItem = { type: 'craft_item', id: template.id, name: template.name, rarity_id: template.rarity_id,
        rarity_display: template.rarity_display, rarity_color: template.rarity_color, count: 1,
        itemType: template.type || 'craft', image: template.image || null };
      newInventory.push(craftedItem);
    }
  }

  if (success) {
    const factionIncrement = shouldGrantCraftExperience(user.faction, chance, true) ? 1 : 0;
    await client.query(`UPDATE users SET inventory = $1, money = $2, craftcount = craftcount + 1,
      craftcreated = craftcreated + 1, faction_craft_count = faction_craft_count + $3 WHERE id = $4`,
      [JSON.stringify(newInventory), moneyAfter, factionIncrement, input.userId]);
    await client.query('UPDATE users SET tutorial_step = 3 WHERE id = $1 AND tutorial_step = 2', [input.userId]);
  } else {
    await client.query('UPDATE users SET inventory = $1, money = $2, craftbroken = craftbroken + 1 WHERE id = $3',
      [JSON.stringify(newInventory), moneyAfter, input.userId]);
  }
  const commission = Math.floor(moneyCost * 0.22);
  if (commission > 0) {
    await changeTreasuryWithClient(client, commission, success ? 'craft_recipe' : 'craft_recipe_fail');
  }
  return success
    ? { status: 200, success, guildId: user.guildid || user.guildId, body: { success: true, inventory: newInventory, moneyAfter, item: craftedItem, message: 'Предмет создан!' } }
    : { status: 200, success, body: { success: false, inventory: newInventory, moneyAfter, message: 'Неудача, предмет разрушен' } };
}
