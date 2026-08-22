export interface OverflowStoredItem {
  id: number;
  userId: number;
  item: string | Record<string, unknown>;
}

export interface InventoryOwner {
  id: number;
  inventory: string | Record<string, unknown>[];
  inventorySlots: number;
}

export interface OverflowTakeTransaction {
  lockOverflowItem(id: number, userId: number): Promise<OverflowStoredItem | null>;
  lockUser(userId: number): Promise<InventoryOwner | null>;
  saveInventory(userId: number, inventory: Record<string, unknown>[]): Promise<void>;
  deleteOverflowItem(id: number, userId: number): Promise<void>;
}

export interface OverflowTakeRepository {
  transaction<T>(callback: (tx: OverflowTakeTransaction) => Promise<T>): Promise<T>;
}

export interface OverflowTakeResult {
  inventory: Record<string, unknown>[];
  remainingSlots: number;
  stacked: boolean;
}

function parseObject(value: string | Record<string, unknown>): Record<string, unknown> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Некорректные данные предмета');
  }
  return { ...(parsed as Record<string, unknown>) };
}

function parseInventory(value: string | Record<string, unknown>[]): Record<string, unknown>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => parseObject(item));
}

function isStackable(item: Record<string, unknown>): boolean {
  return item.type === 'craft_item' || item.type === 'material' || item.type === 'upgrade';
}

export async function takeOverflowItem(
  repository: OverflowTakeRepository,
  input: { overflowId: number; userId: number },
): Promise<OverflowTakeResult> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('Пользователь не найден');

    const stored = await tx.lockOverflowItem(input.overflowId, input.userId);
    if (!stored) throw new Error('Предмет не найден');

    const item = parseObject(stored.item);
    const inventory = parseInventory(owner.inventory);
    let stacked = false;

    if (isStackable(item)) {
      const incomingCount = item.count === undefined ? 1 : Number(item.count);
      if (!Number.isInteger(incomingCount) || incomingCount <= 0) {
        throw new Error('Некорректное количество предмета');
      }
      const existingIndex = inventory.findIndex(candidate =>
        isStackable(candidate)
        && String(candidate.id) === String(item.id)
      );
      if (existingIndex !== -1) {
        const existing = inventory[existingIndex]!;
        const existingCount = existing.count === undefined ? 0 : Number(existing.count);
        if (!Number.isInteger(existingCount) || existingCount < 0) {
          throw new Error('Некорректное количество предмета');
        }
        existing.count = existingCount + incomingCount;
        stacked = true;
      }
    }

    if (!stacked) {
      const equipmentCount = inventory.filter(candidate => Boolean(candidate.slot)).length;
      if (item.slot && equipmentCount >= owner.inventorySlots) {
        throw new Error('Инвентарь заполнен');
      }
      inventory.push(item);
    }

    await tx.saveInventory(input.userId, inventory);
    await tx.deleteOverflowItem(input.overflowId, input.userId);

    return {
      inventory,
      remainingSlots: Math.max(0, owner.inventorySlots - inventory.filter(candidate => Boolean(candidate.slot)).length),
      stacked,
    };
  });
}
