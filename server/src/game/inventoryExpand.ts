export interface InventoryExpandOwner {
  id: number;
  inventorySlots: number;
  money: number;
}

export interface InventoryExpandTransaction {
  lockUser(userId: number): Promise<InventoryExpandOwner | null>;
  saveExpansion(userId: number, inventorySlots: number, money: number): Promise<void>;
}

export interface InventoryExpandRepository {
  transaction<T>(callback: (tx: InventoryExpandTransaction) => Promise<T>): Promise<T>;
}

const MIN_SLOTS = 10;
const MAX_SLOTS = 30;

export async function expandInventory(
  repository: InventoryExpandRepository,
  input: { userId: number },
): Promise<{ inventorySlots: number; moneyAfter: number }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');

    const rawSlots = Number(owner.inventorySlots);
    const currentSlots = rawSlots === 0 ? MIN_SLOTS : rawSlots;
    const money = Number(owner.money);
    if (!Number.isInteger(currentSlots) || currentSlots < MIN_SLOTS || !Number.isFinite(money)) {
      throw new Error('Некорректные данные пользователя');
    }
    if (currentSlots >= MAX_SLOTS) {
      throw new Error(`Достигнут максимум слотов (${MAX_SLOTS})`);
    }

    const price = 100 * Math.pow(2, currentSlots - MIN_SLOTS);
    if (money < price) {
      throw new Error(`Недостаточно серебра. Нужно ${price}, есть ${money}`);
    }

    const inventorySlots = currentSlots + 1;
    const moneyAfter = money - price;
    await tx.saveExpansion(input.userId, inventorySlots, moneyAfter);
    return { inventorySlots, moneyAfter };
  });
}
