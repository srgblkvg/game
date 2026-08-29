import type { PoolClient } from 'pg';
import { changeTreasuryWithClient } from './treasury';
import { getCraftFactionBonus, shouldGrantCraftExperience } from './craftOperations';

export interface CraftUpgradeInput {
  userId: number;
  slots: any[];
  random?: () => number;
  now?: () => number;
}

export interface CraftAnnouncement {
  id: number;
  senderId: 0;
  senderName: 'Глашатай';
  targetId: null;
  content: string;
  createdAt: string;
}

export interface CraftUpgradeResult {
  status: number;
  body: Record<string, any>;
  guildId?: number;
  announcements?: CraftAnnouncement[];
}

const STONE_BONUS: Record<number, number> = { 0: 0, 1: 5, 2: 10, 3: 15, 4: 20, 5: 30, 6: 50 };

function isCraftItem(item: any): boolean {
  return item?.type === 'material' || item?.type === 'craft_item';
}

function error(status: number, message: string): CraftUpgradeResult {
  return { status, body: { error: message } };
}

function value(row: any, camel: string, snake: string, fallback?: any): any {
  return row?.[camel] ?? row?.[snake] ?? fallback;
}

export async function executeCraftUpgradeWithClient(
  client: PoolClient,
  input: CraftUpgradeInput,
): Promise<CraftUpgradeResult> {
  const random = input.random || Math.random;
  // Serialize treasury commission with all other upgrade reads/writes.
  await client.query('SELECT amount FROM castle_treasury WHERE id = 1 FOR UPDATE');
  const user = (await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [input.userId])).rows[0] as any;
  if (!user) return error(404, 'User not found');

  const itemSlot = input.slots.find((slot: any) => slot && !isCraftItem(slot));
  const stoneSlot = input.slots.find((slot: any) => slot && isCraftItem(slot) && slot.itemType === 'upgrade');
  if (!itemSlot || !stoneSlot) return error(400, 'Положите предмет и камень усиления');

  const inventory: any[] = JSON.parse(user.inventory || '[]');
  const itemIndex = inventory.findIndex(item => item.id === itemSlot.id && !isCraftItem(item));
  if (itemIndex === -1) return error(400, 'Предмет не найден в инвентаре');
  const itemToUpgrade = inventory[itemIndex];
  if (itemToUpgrade.locked) return error(400, 'Предмет заблокирован. Разблокируйте в инвентаре.');

  const currentLevel = itemToUpgrade.upgradeLevel || 0;
  const targetLevel = currentLevel + 1;
  const stoneIndex = inventory.findIndex(item => isCraftItem(item) && item.id === stoneSlot.id && item.itemType === 'upgrade');
  if (stoneIndex === -1) return error(400, 'Камень усиления не найден в инвентаре');
  const stone = inventory[stoneIndex];
  if (stone.count < 1) return error(400, 'Недостаточно камней усиления');

  const upgradeData = (await client.query(
    'SELECT chance, money_cost FROM upgrade_chances WHERE level = $1 AND rarity_id = $2',
    [targetLevel, itemSlot.rarity_id],
  )).rows[0] as any;
  if (!upgradeData) return error(400, 'Нет данных для этого уровня улучшения. Свяжитесь с администратором.');

  const chance = Number(upgradeData.chance);
  const moneyCost = Number(upgradeData.money_cost);
  const stoneBonus = STONE_BONUS[stone.rarity_id] || 0;
  const faction = value(user, 'faction', 'faction');
  const factionCount = value(user, 'factionCraftCount', 'faction_craft_count', 0);
  const finalChance = Math.min(100, chance + stoneBonus + getCraftFactionBonus(faction, factionCount));
  const actualCost = Math.max(1, Math.floor(moneyCost / 4));
  const money = Number(value(user, 'money', 'money', 0));
  if (money < actualCost) return error(400, `Недостаточно денег. Требуется ${actualCost}`);

  const newInventory = [...inventory];
  if (stone.count > 1) newInventory[stoneIndex] = { ...stone, count: stone.count - 1 };
  else newInventory.splice(stoneIndex, 1);
  const moneyAfter = money - actualCost;
  const success = random() * 100 < finalChance;
  const announcements: CraftAnnouncement[] = [];

  if (success) {
    const itemIdx = newInventory.findIndex(item => item.id === itemSlot.id && !isCraftItem(item));
    if (itemIdx === -1) return error(500, 'Внутренняя ошибка: предмет не найден после списания камня');
    newInventory[itemIdx] = { ...newInventory[itemIdx], upgradeLevel: targetLevel };
    const ratingBonus = targetLevel === 7 ? 5 : targetLevel === 10 ? 50 : 0;
    const factionIncrement = shouldGrantCraftExperience(faction, finalChance, true);
    if (ratingBonus > 0) {
      const elo = Math.max(100, Number(value(user, 'elo', 'elo', 1000)) + ratingBonus);
      const factionSql = factionIncrement ? ', faction_craft_count = faction_craft_count + 1' : '';
      await client.query(`UPDATE users SET money = $1, inventory = $2, elo = $3, pverating = pverating + $4,
        craftcount = craftcount + 1, craftupgraded = craftupgraded + 1${factionSql} WHERE id = $5`,
        [moneyAfter, JSON.stringify(newInventory), elo, ratingBonus, input.userId]);
    } else {
      const factionSql = factionIncrement ? ', faction_craft_count = faction_craft_count + 1' : '';
      await client.query(`UPDATE users SET inventory = $1, money = $2, craftcount = craftcount + 1,
        craftupgraded = craftupgraded + 1${factionSql} WHERE id = $3`,
        [JSON.stringify(newInventory), moneyAfter, input.userId]);
    }
    const commission = Math.floor(actualCost * 0.22);
    if (commission > 0) await changeTreasuryWithClient(client, commission, 'craft_upgrade');
    if (targetLevel >= 7) {
      const content = `⚒️ ${value(user, 'username', 'username', '')} улучшил ${itemToUpgrade.name || 'Предмет'} до +${targetLevel}!`;
      const inserted = await client.query(
        'INSERT INTO chat_messages (senderId, targetId, content) VALUES (0, NULL, $1) RETURNING id',
        [content],
      );
      announcements.push({ id: Number(inserted.rows[0].id), senderId: 0, senderName: 'Глашатай', targetId: null, content, createdAt: new Date().toISOString() });
    }
    const body: Record<string, any> = { success: true, inventory: newInventory, moneyAfter, message: `Предмет улучшен до +${targetLevel}${ratingBonus > 0 ? ` (+${ratingBonus} рейтинга)` : ''}` };
    if (ratingBonus > 0) body.eloAdded = ratingBonus;
    return { status: 200, guildId: value(user, 'guildId', 'guildid'), announcements, body };
  }

  if (targetLevel >= 7) {
    const destroyed = newInventory.findIndex(item => item.id === itemSlot.id && !isCraftItem(item));
    if (destroyed !== -1) {
      const rarityId = newInventory[destroyed].rarity_id || 0;
      const craftItem = (await client.query(`SELECT c.id, c.name, c.rarity_id, c.type, c.image,
        r.display_name AS rarity_display, r.color AS rarity_color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id
        WHERE c.rarity_id = $1 AND c.type = 'craft'`, [rarityId])).rows[0] as any;
      if (craftItem) {
        const existing = newInventory.find(item => isCraftItem(item) && item.id === craftItem.id);
        if (existing) existing.count += 1;
        else newInventory.push({ type: 'craft_item', id: craftItem.id, name: craftItem.name, rarity_id: craftItem.rarity_id, rarity_display: craftItem.rarity_display, rarity_color: craftItem.rarity_color, count: 1, itemType: craftItem.type || 'craft', image: craftItem.image || null });
      }
      newInventory.splice(destroyed, 1);
    }
    await client.query('UPDATE users SET inventory = $1, money = $2, craftbroken = craftbroken + 1 WHERE id = $3', [JSON.stringify(newInventory), moneyAfter, input.userId]);
    const commission = Math.floor(actualCost * 0.22);
    if (commission > 0) await changeTreasuryWithClient(client, commission, 'craft_upgrade_fail');
    const content = `💥 ${value(user, 'username', 'username', '')} сломал ${itemToUpgrade.name || 'Предмет'} (+${currentLevel}) при улучшении!`;
    const inserted = await client.query(
      'INSERT INTO chat_messages (senderId, targetId, content) VALUES (0, NULL, $1) RETURNING id',
      [content],
    );
    const announcement: CraftAnnouncement = { id: Number(inserted.rows[0].id), senderId: 0, senderName: 'Глашатай', targetId: null, content, createdAt: new Date().toISOString() };
    announcements.push(announcement);
    return { status: 200, guildId: value(user, 'guildId', 'guildid'), announcements, body: { success: false, inventory: newInventory, moneyAfter, message: 'Неудача! Предмет разрушен.' } };
  }

  await client.query('UPDATE users SET inventory = $1, money = $2 WHERE id = $3', [JSON.stringify(newInventory), moneyAfter, input.userId]);
  const commission = Math.floor(actualCost * 0.22);
  if (commission > 0) await changeTreasuryWithClient(client, commission, 'craft_upgrade_fail');
  return { status: 200, guildId: value(user, 'guildId', 'guildid'), body: { success: false, inventory: newInventory, moneyAfter, message: 'Неудача! Предмет не улучшен.' } };
}
