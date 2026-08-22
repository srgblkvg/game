import { currentStats, isSlotCompatible, type CharStats, type GameItem, type StatRecord } from './stats';

export interface EquipmentOwner {
  id: number;
  currentHp: number;
  baseS: number;
  baseA: number;
  baseD: number;
  baseM: number;
  inventory: string | Record<string, any>[];
  equipment: string | Record<string, any>;
  activeEquipSlot: number;
}

export interface EquipmentState {
  userId: number;
  activeEquipSlot: number;
  inventory: Record<string, any>[];
  equipment: Record<string, any>;
  currentHp: number;
  lastHpUpdate: number;
}

export interface EquipmentChangeTransaction {
  lockUser(userId: number): Promise<EquipmentOwner | null>;
  saveState(state: EquipmentState): Promise<void>;
}

export interface EquipmentChangeRepository {
  transaction<T>(callback: (tx: EquipmentChangeTransaction) => Promise<T>): Promise<T>;
}

export interface EquipmentChangeInput {
  userId: number;
  slotId: string;
  itemId: string | number | null;
  now: number;
  drinkBonuses: StatRecord;
  collectionBonus: number;
  guildBonus: number;
}

export interface EquipmentChangeResult {
  inventory: Record<string, any>[];
  equipment: Record<string, any>;
  currentHp: number;
  maxHp: number;
  stats: CharStats;
}

const EQUIPMENT_SLOTS = new Set([
  'weapon1', 'shield', 'helmet', 'chest', 'gloves',
  'boots', 'amulet', 'belt', 'ring1', 'ring2',
]);

function parseArray(value: string | Record<string, any>[]): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return structuredClone(parsed);
}

function parseObject(value: string | Record<string, any>): Record<string, any> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '{}') : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Некорректная экипировка');
  return structuredClone(parsed as Record<string, any>);
}

function recalcHp(currentHp: number, oldMaxHp: number, newMaxHp: number): number {
  return Math.max(1, Math.floor(currentHp * newMaxHp / (oldMaxHp || 1)));
}

export async function changeEquipment(
  repository: EquipmentChangeRepository,
  input: EquipmentChangeInput,
): Promise<EquipmentChangeResult> {
  if (!EQUIPMENT_SLOTS.has(input.slotId)) throw new Error('Некорректный слот экипировки');
  return repository.transaction(async tx => {
    const user = await tx.lockUser(input.userId);
    if (!user) throw new Error('User not found');

    const inventory = parseArray(user.inventory);
    const equipment = parseObject(user.equipment);
    const currentEquipped = equipment[input.slotId];
    const base: StatRecord = { s: user.baseS, a: user.baseA, d: user.baseD, m: user.baseM };

    if (input.itemId === null) {
      if (!currentEquipped) throw new Error('Слот пуст');
      const oldStats = currentStats(base, equipment as Record<string, GameItem>, input.drinkBonuses, input.collectionBonus, input.guildBonus);
      inventory.push(currentEquipped);
      delete equipment[input.slotId];
      const newStats = currentStats(base, equipment as Record<string, GameItem>, input.drinkBonuses, input.collectionBonus, input.guildBonus);
      const currentHp = recalcHp(user.currentHp, oldStats.hp, newStats.hp);
      await tx.saveState({ userId: input.userId, activeEquipSlot: user.activeEquipSlot, inventory, equipment, currentHp, lastHpUpdate: input.now });
      return { inventory, equipment, currentHp, maxHp: newStats.hp, stats: newStats };
    }

    const itemIndex = inventory.findIndex(item => String(item.id) === String(input.itemId));
    if (itemIndex === -1) throw new Error('Предмет не найден в инвентаре');
    const item = inventory[itemIndex]!;
    if (item.locked) throw new Error('Предмет заблокирован. Разблокируйте в инвентаре.');
    if (item.type === 'material' || item.type === 'craft_item') throw new Error('Нельзя надеть материал или ресурс');
    if (!isSlotCompatible(input.slotId, item as GameItem)) throw new Error('Предмет не подходит к слоту');
    if (item.name?.includes('двуручн') && input.slotId !== 'weapon1') throw new Error('Двуручное оружие можно надеть только в первый слот');

    if ((input.slotId === 'ring1' || input.slotId === 'ring2') && item.slot?.startsWith('ring')) {
      const otherSlot = input.slotId === 'ring1' ? 'ring2' : 'ring1';
      if (equipment[otherSlot]?.name === item.name) throw new Error('Нельзя надеть два одинаковых кольца');
    }

    if (item.name?.includes('двуручн') && input.slotId === 'weapon1' && equipment.shield) {
      inventory.push(equipment.shield);
      delete equipment.shield;
    }
    if (currentEquipped) inventory.push(currentEquipped);

    const oldStats = currentStats(base, equipment as Record<string, GameItem>, input.drinkBonuses, input.collectionBonus, input.guildBonus);
    inventory.splice(itemIndex, 1);
    equipment[input.slotId] = item;
    const newStats = currentStats(base, equipment as Record<string, GameItem>, input.drinkBonuses, input.collectionBonus, input.guildBonus);
    const currentHp = recalcHp(user.currentHp, oldStats.hp, newStats.hp);

    await tx.saveState({ userId: input.userId, activeEquipSlot: user.activeEquipSlot, inventory, equipment, currentHp, lastHpUpdate: input.now });
    return { inventory, equipment, currentHp, maxHp: newStats.hp, stats: newStats };
  });
}
