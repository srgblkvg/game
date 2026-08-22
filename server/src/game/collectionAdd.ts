export interface CollectionAddOwner {
  id: number;
  inventory: string | Record<string, any>[];
}

export interface CollectionAddTransaction {
  lockUser(userId: number): Promise<CollectionAddOwner | null>;
  isCollectionSetItem(itemName: string, slot: string, rarityId: number): Promise<boolean>;
  hasCollectionItem(
    userId: number,
    itemName: string,
    slot: string,
    rarityId: number,
    plusTab: boolean,
  ): Promise<boolean>;
  saveInventory(userId: number, inventory: Record<string, any>[]): Promise<void>;
  insertCollectionItem(
    userId: number,
    itemName: string,
    slot: string,
    rarityId: number,
    upgradeLevel: number,
  ): Promise<void>;
}

export interface CollectionAddRepository {
  transaction<T>(callback: (tx: CollectionAddTransaction) => Promise<T>): Promise<T>;
}

function parseInventory(value: CollectionAddOwner['inventory']): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Некорректный предмет в инвентаре');
    }
    return { ...item };
  });
}

export async function addInventoryItemToCollection(
  repository: CollectionAddRepository,
  input: {
    userId: number;
    itemName: string;
    slot: string;
    itemId?: string | number;
    requestedRarityId?: number;
    targetLevel: number;
  },
): Promise<{ success: true; removed: Record<string, any> }> {
  if (!input.itemName || !input.slot) throw new Error('itemName и slot обязательны');
  if (input.targetLevel !== 0 && input.targetLevel !== 7) {
    throw new Error('Некорректная вкладка коллекции');
  }

  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('Пользователь не найден');
    const inventory = parseInventory(owner.inventory);

    let itemIndex = -1;
    if (input.itemId !== undefined) {
      itemIndex = inventory.findIndex(item => String(item.id) === String(input.itemId));
    }
    if (itemIndex === -1) {
      const candidates = inventory
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.name === input.itemName && item.slot === input.slot);
      itemIndex = (candidates.find(({ item }) => !item.locked) || candidates[0])?.index ?? -1;
    }
    if (itemIndex === -1) throw new Error('Предмет не найден в инвентаре');

    const selected = inventory[itemIndex]!;
    if (selected.locked) {
      throw new Error('Предмет заблокирован. Разблокируйте в инвентаре.');
    }
    if (selected.name !== input.itemName || selected.slot !== input.slot) {
      throw new Error('Предмет не соответствует выбранной коллекции');
    }

    const actualUpgrade = Number(selected.upgradeLevel ?? selected.upgradelevel ?? 0);
    if (input.targetLevel === 0 && actualUpgrade >= 7) {
      throw new Error('Предметы +7 и выше нельзя добавить в базовую коллекцию. Переключитесь на вкладку +7.');
    }
    if (input.targetLevel === 7 && actualUpgrade < 7) {
      throw new Error('Предметы ниже +7 нельзя добавить в коллекцию +7. Переключитесь на базовую вкладку.');
    }
    const rarityId = Number(selected.rarity_id ?? selected.rarityId ?? 0);
    if (!await tx.isCollectionSetItem(input.itemName, input.slot, rarityId)) {
      throw new Error('Предмет не входит в коллекцию');
    }
    if (await tx.hasCollectionItem(
      input.userId,
      input.itemName,
      input.slot,
      rarityId,
      input.targetLevel >= 7,
    )) {
      throw new Error('Предмет уже в коллекции');
    }

    const [removed] = inventory.splice(itemIndex, 1);
    await tx.saveInventory(input.userId, inventory);
    await tx.insertCollectionItem(
      input.userId,
      input.itemName,
      input.slot,
      rarityId,
      actualUpgrade,
    );
    return { success: true, removed: removed! };
  });
}
