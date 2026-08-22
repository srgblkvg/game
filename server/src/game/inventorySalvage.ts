export interface SalvageOwner {
  id: number;
  inventory: string | Record<string, any>[];
}

export interface SalvageMaterial {
  id: string | number;
  name: string;
  rarityId: number;
  type: string | null;
  image: string | null;
  rarityDisplay: string;
  rarityColor: string;
}

export interface InventorySalvageTransaction {
  lockUser(userId: number): Promise<SalvageOwner | null>;
  findMaterial(rarityId: number): Promise<SalvageMaterial | null>;
  saveInventory(userId: number, inventory: Record<string, any>[]): Promise<void>;
}

export interface InventorySalvageRepository {
  transaction<T>(callback: (tx: InventorySalvageTransaction) => Promise<T>): Promise<T>;
}

export interface InventorySalvageResult {
  success: true;
  inventory: Record<string, any>[];
  salvagedCount: number;
}

function parseInventory(value: SalvageOwner['inventory']): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Некорректный предмет в инвентаре');
    }
    return { ...item };
  });
}

export async function salvageInventory(
  repository: InventorySalvageRepository,
  input: { userId: number; itemIds: Array<string | number> },
): Promise<InventorySalvageResult> {
  if (!Array.isArray(input.itemIds)) throw new Error('Некорректный список предметов');
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');

    const selected = new Set(input.itemIds.map(id => String(id)));
    const originalInventory = parseInventory(owner.inventory);
    if (originalInventory.some(item => selected.has(String(item.id)) && item.locked)) {
      throw new Error('Предмет заблокирован. Разблокируйте в инвентаре.');
    }
    const materialCounts = new Map<number, number>();
    const inventory = originalInventory.filter(item => {
      if (!selected.has(String(item.id)) || item.type === 'craft_item') return true;
      const rarityId = Number(item.rarity_id ?? 0);
      materialCounts.set(rarityId, (materialCounts.get(rarityId) || 0) + 1);
      return false;
    });

    for (const [rarityId, count] of materialCounts) {
      const material = await tx.findMaterial(rarityId);
      if (!material) throw new Error('Материал для редкости не найден');
      const existing = inventory.find(item =>
        item.type === 'craft_item' && String(item.id) === String(material.id)
      );
      if (existing) {
        existing.count = Number(existing.count || 0) + count;
      } else {
        inventory.push({
          type: 'craft_item',
          id: material.id,
          name: material.name,
          rarity_id: material.rarityId,
          rarity_display: material.rarityDisplay,
          rarity_color: material.rarityColor,
          count,
          itemType: material.type || 'craft',
          image: material.image || null,
        });
      }
    }

    await tx.saveInventory(input.userId, inventory);
    return {
      success: true,
      inventory,
      salvagedCount: [...materialCounts.values()].reduce((sum, count) => sum + count, 0),
    };
  });
}
