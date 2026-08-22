export interface InventoryArrangeOwner {
  id: number;
  inventory: string | Record<string, any>[];
}

export interface InventoryArrangeTransaction {
  lockUser(userId: number): Promise<InventoryArrangeOwner | null>;
  saveInventory(userId: number, inventory: Record<string, any>[]): Promise<void>;
}

export interface InventoryArrangeRepository {
  transaction<T>(callback: (tx: InventoryArrangeTransaction) => Promise<T>): Promise<T>;
}

function parseInventory(value: InventoryArrangeOwner['inventory']): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Некорректный предмет в инвентаре');
    }
    return { ...item };
  });
}

export async function reorderInventory(
  repository: InventoryArrangeRepository,
  input: { userId: number; order: Array<string | number> },
): Promise<{ success: true }> {
  if (!Array.isArray(input.order)) throw new Error('Неверный формат');
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');

    const seenEquipment = new Set<string>();
    const inventory = parseInventory(owner.inventory).filter(item => {
      if (item.type === 'craft_item') return true;
      const key = String(item.id);
      if (seenEquipment.has(key)) return false;
      seenEquipment.add(key);
      return true;
    });
    const uniqueOrder = [...new Set(input.order.map(String))];
    const idMap = new Map(inventory.map(item => [String(item.id), item]));
    const reordered = uniqueOrder.map(id => idMap.get(id)).filter(Boolean) as Record<string, any>[];
    const orderedIds = new Set(uniqueOrder);
    for (const item of inventory) {
      if (!orderedIds.has(String(item.id))) reordered.push(item);
    }

    await tx.saveInventory(input.userId, reordered);
    return { success: true };
  });
}

export async function toggleInventoryLock(
  repository: InventoryArrangeRepository,
  input: { userId: number; itemId: string | number },
): Promise<{ success: true; locked: boolean }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');

    const inventory = parseInventory(owner.inventory);
    const itemIndex = inventory.findIndex(item => String(item.id) === String(input.itemId));
    if (itemIndex === -1) throw new Error('Предмет не найден');
    const item = inventory[itemIndex]!;
    const locked = !item.locked;
    inventory[itemIndex] = { ...item, locked };

    await tx.saveInventory(input.userId, inventory);
    return { success: true, locked };
  });
}
