export interface InventoryDropOwner {
  id: number;
  inventory: string | Record<string, any>[];
}

export interface InventoryDropTransaction {
  lockUser(userId: number): Promise<InventoryDropOwner | null>;
  saveInventory(userId: number, inventory: Record<string, any>[]): Promise<void>;
}

export interface InventoryDropRepository {
  transaction<T>(callback: (tx: InventoryDropTransaction) => Promise<T>): Promise<T>;
}

function parseInventory(value: InventoryDropOwner['inventory']): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Некорректный предмет в инвентаре');
    }
    return { ...item };
  });
}

function isStackable(item: Record<string, any>): boolean {
  return item.type === 'craft_item';
}

export async function grantInventoryDrops(
  repository: InventoryDropRepository,
  input: { userId: number; drops: Record<string, any>[] },
): Promise<{ inventory: Record<string, any>[] }> {
  if (!Array.isArray(input.drops)) throw new Error('Некорректный список добычи');
  if (input.drops.length === 0) return { inventory: [] };

  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    const inventory = parseInventory(owner.inventory);

    for (const sourceDrop of input.drops) {
      if (!sourceDrop || typeof sourceDrop !== 'object' || Array.isArray(sourceDrop)) {
        throw new Error('Некорректный предмет добычи');
      }
      const drop = { ...sourceDrop };
      if (isStackable(drop)) {
        const count = drop.count === undefined ? 1 : Number(drop.count);
        if (!Number.isInteger(count) || count <= 0) {
          throw new Error('Некорректное количество добычи');
        }
        const existing = inventory.find(item =>
          isStackable(item) && item.id === drop.id
        );
        if (existing) {
          const existingCount = existing.count === undefined ? 0 : Number(existing.count);
          if (!Number.isInteger(existingCount) || existingCount < 0) {
            throw new Error('Некорректное количество предмета');
          }
          existing.count = existingCount + count;
          continue;
        }
        drop.count = count;
      }
      inventory.push(drop);
    }

    await tx.saveInventory(input.userId, inventory);
    return { inventory };
  });
}
