export const AUCTION_PRICE_FLOOR: Readonly<Record<number, number>> = {
  0: 5, 1: 20, 2: 100, 3: 400, 4: 1500, 5: 6000, 6: 20000,
};

export interface AuctionSeller {
  id: number;
  username: string;
  money: number;
  premiumUntil: number;
  inventory: string | unknown[];
}

export interface AuctionSellTransaction {
  lockSeller(userId: number): Promise<AuctionSeller | null>;
  countActiveLots(userId: number, now: number): Promise<number>;
  updateSeller(userId: number, money: number, inventory: unknown[]): Promise<void>;
  insertLot(data: {
    sellerId: number; item: Record<string, unknown>; startPrice: number;
    buyoutPrice: number | null; duration: number; endsAt: number; createdAt: number;
  }): Promise<number>;
  addTreasuryCommission(amount: number, source: string): Promise<void>;
  insertSellMessage(data: AuctionSellResult): Promise<number>;
}

export interface AuctionSellRepository {
  transaction<T>(callback: (tx: AuctionSellTransaction) => Promise<T>): Promise<T>;
}

export interface AuctionSellResult {
  lotId: number;
  sellerId: number;
  sellerName: string;
  item: Record<string, unknown>;
  startPrice: number;
  buyoutPrice: number | null;
  duration: number;
  endsAt: number;
  createdAt: string;
  listingFee: number;
  chatMessageId: number;
}

function parseInventory(value: string | unknown[]): Record<string, unknown>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => ({ ...(item as Record<string, unknown>) }));
}

export async function sellAuctionLot(
  repository: AuctionSellRepository,
  input: {
    sellerId: number; itemId: string | number; startPrice: number;
    buyoutPrice?: number | null; duration?: number; count?: number; now: number;
  },
): Promise<AuctionSellResult> {
  return repository.transaction(async tx => {
    const seller = await tx.lockSeller(input.sellerId);
    if (!seller) throw new Error('Пользователь не найден');

    const activeLots = await tx.countActiveLots(input.sellerId, input.now);
    const maxLots = seller.premiumUntil > input.now ? 20 : 10;
    if (activeLots >= maxLots) throw new Error(`Максимум ${maxLots} лотов`);

    const inventory = parseInventory(seller.inventory);
    const index = inventory.findIndex(item => String(item.id) === String(input.itemId));
    const storedItem = inventory[index];
    if (index < 0 || !storedItem) throw new Error('Предмет не найден в инвентаре');
    if (storedItem.locked) throw new Error('Предмет заблокирован. Разблокируйте в инвентаре.');

    const isMaterial = storedItem.type === 'craft_item' || storedItem.type === 'material';
    const availableCount = isMaterial ? Number(storedItem.count) : 1;
    const requestedCount = input.count === undefined || input.count === null
      ? availableCount
      : Number(input.count);
    if (!Number.isSafeInteger(availableCount) || availableCount < 1
      || !Number.isSafeInteger(requestedCount) || requestedCount < 1) {
      throw new Error('Некорректное количество');
    }
    const itemCount = isMaterial ? requestedCount : 1;
    if (isMaterial && itemCount > availableCount) {
      throw new Error(`Недостаточно: есть ${availableCount}, выбрано ${itemCount}`);
    }

    const rawStartPrice = Number(input.startPrice);
    const rawBuyoutPrice = input.buyoutPrice === undefined || input.buyoutPrice === null
      ? null
      : Number(input.buyoutPrice);
    if (!Number.isSafeInteger(rawStartPrice) || rawStartPrice < 1
      || (rawBuyoutPrice !== null && (!Number.isSafeInteger(rawBuyoutPrice) || rawBuyoutPrice < 1))) {
      throw new Error('Некорректная цена');
    }
    const unitStartPrice = rawStartPrice;
    const unitBuyoutPrice = rawBuyoutPrice;
    const rarity = Number(storedItem.rarity_id ?? 0);
    const floor = storedItem.itemType === 'upgrade' ? 2000 : (AUCTION_PRICE_FLOOR[rarity] || 5);
    if (!Number.isFinite(unitStartPrice) || unitStartPrice < floor) {
      throw new Error(`Мин. цена за 1 шт для этой редкости: ${floor} серебра`);
    }
    if (unitBuyoutPrice !== null && unitBuyoutPrice <= unitStartPrice) {
      throw new Error('Цена выкупа должна быть выше стартовой');
    }

    const requestedDuration = Number(input.duration);
    const duration = [6, 12, 24, 48].includes(requestedDuration) ? requestedDuration : 24;
    const totalStartPrice = unitStartPrice * itemCount;
    const totalBuyoutPrice = unitBuyoutPrice === null ? null : unitBuyoutPrice * itemCount;
    if (!Number.isSafeInteger(totalStartPrice)
      || (totalBuyoutPrice !== null && !Number.isSafeInteger(totalBuyoutPrice))) {
      throw new Error('Некорректная цена');
    }
    const listingFee = Math.max(1, Math.floor(totalStartPrice * 0.05));
    if (seller.money < listingFee) {
      throw new Error(`Недостаточно монет для листинга (${listingFee} серебра)`);
    }

    if (isMaterial && itemCount < availableCount) storedItem.count = availableCount - itemCount;
    else inventory.splice(index, 1);
    const item = { ...storedItem, count: itemCount, type: storedItem.type || 'item' };
    const endsAt = input.now + duration * 3600;

    await tx.updateSeller(seller.id, seller.money - listingFee, inventory);
    const lotId = await tx.insertLot({ sellerId: seller.id, item, startPrice: totalStartPrice,
      buyoutPrice: totalBuyoutPrice, duration, endsAt, createdAt: input.now });
    await tx.addTreasuryCommission(listingFee, 'auction_listing');
    const result: AuctionSellResult = { lotId, sellerId: seller.id, sellerName: seller.username,
      item, startPrice: totalStartPrice, buyoutPrice: totalBuyoutPrice, duration, endsAt,
      createdAt: new Date(input.now * 1000).toISOString(), listingFee, chatMessageId: 0 };
    result.chatMessageId = await tx.insertSellMessage(result);
    return result;
  });
}
