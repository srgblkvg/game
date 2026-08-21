export interface PartialPurchaseInput {
  startPrice: number;
  buyoutPrice: number | null;
  currentBid: number | null;
  currentBidderId: number | null;
  stackCount: number;
}

export interface PartialPurchasePlan {
  quantity: number;
  remainingCount: number;
  pricePerItem: number;
  cost: number;
  commission: number;
  payout: number;
  newStartPrice: number | null;
  newBuyoutPrice: number | null;
  newCurrentBid: number | null;
  bidderRefund: number;
  removeLot: boolean;
}

export function calculatePartialPurchase(input: PartialPurchaseInput, quantity: number): PartialPurchasePlan {
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('Укажите корректное количество');
  if (input.stackCount <= 1) throw new Error('Этот лот нельзя купить частично');
  if (quantity > input.stackCount) throw new Error(`В лоте только ${input.stackCount} шт.`);

  const totalPrice = input.buyoutPrice ?? input.currentBid ?? input.startPrice;
  const pricePerItem = Math.ceil(totalPrice / input.stackCount);
  const cost = pricePerItem * quantity;
  const commission = Math.floor(cost * 0.1);
  const remainingCount = input.stackCount - quantity;
  const removeLot = remainingCount === 0;

  let newStartPrice: number | null = null;
  let newBuyoutPrice: number | null = null;
  let newCurrentBid: number | null = null;
  if (!removeLot) {
    newStartPrice = Math.max(1, Math.floor(input.startPrice * remainingCount / input.stackCount));
    newBuyoutPrice = input.buyoutPrice === null
      ? null
      : Math.max(1, Math.floor(input.buyoutPrice * remainingCount / input.stackCount));
    newCurrentBid = input.currentBid === null
      ? null
      : Math.max(newStartPrice, Math.floor(input.currentBid * remainingCount / input.stackCount));
  }

  const bidderRefund = input.currentBidderId !== null && input.currentBid !== null
    ? input.currentBid - (newCurrentBid ?? 0)
    : 0;

  return {
    quantity,
    remainingCount,
    pricePerItem,
    cost,
    commission,
    payout: cost - commission,
    newStartPrice,
    newBuyoutPrice,
    newCurrentBid,
    bidderRefund,
    removeLot,
  };
}

export interface PartialAuctionLot extends PartialPurchaseInput {
  id: number;
  sellerId: number;
  itemData: string | Record<string, unknown>;
}

export interface PartialPurchaseTransaction {
  lockActiveLot(lotId: number, now: number): Promise<PartialAuctionLot | null>;
  lockBuyer(userId: number): Promise<{ money: number } | null>;
  addOverflowItem(userId: number, item: Record<string, unknown>, auctionLotId: number): Promise<void>;
  updateLot(lotId: number, item: Record<string, unknown>, plan: PartialPurchasePlan): Promise<void>;
  deleteLot(lotId: number): Promise<void>;
  deleteAuctionMessages(lotId: number): Promise<void>;
  creditOverflowMoney(userId: number, amount: number): Promise<void>;
  debitBuyer(userId: number, amount: number): Promise<void>;
  creditSeller(userId: number, amount: number): Promise<void>;
  addTreasuryCommission(amount: number, source: string): Promise<void>;
  insertHistory(entry: {
    sellerId: number; buyerId: number; itemName: string; itemData: string;
    price: number; commission: number; createdAt: string;
  }): Promise<void>;
}

export interface PartialPurchaseRepository {
  transaction<T>(callback: (tx: PartialPurchaseTransaction) => Promise<T>): Promise<T>;
}

export interface PartialPurchaseResult extends PartialPurchasePlan {
  lotId: number;
  sellerId: number;
  buyerId: number;
  itemName: string;
}

function parseItem(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== 'string') return { ...value };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Некорректные данные предмета аукционного лота');
  }
  return { ...(parsed as Record<string, unknown>) };
}

export async function purchasePartialAuctionLot(
  repository: PartialPurchaseRepository,
  input: { lotId: number; buyerId: number; quantity: number; now: number },
): Promise<PartialPurchaseResult> {
  return repository.transaction(async (tx) => {
    const lot = await tx.lockActiveLot(input.lotId, input.now);
    if (!lot) throw new Error('Лот не найден или истёк');
    if (lot.sellerId === input.buyerId) throw new Error('Нельзя купить свой лот');

    const item = parseItem(lot.itemData);
    const plan = calculatePartialPurchase({ ...lot, stackCount: Number(item.count || 1) }, input.quantity);
    const buyer = await tx.lockBuyer(input.buyerId);
    if (!buyer || buyer.money < plan.cost) {
      throw new Error(`Недостаточно серебра. Нужно ${plan.cost}, есть ${buyer?.money || 0}`);
    }

    await tx.addOverflowItem(input.buyerId, { ...item, count: input.quantity }, lot.id);
    if (plan.removeLot) {
      await tx.deleteAuctionMessages(lot.id);
      await tx.deleteLot(lot.id);
    } else {
      await tx.updateLot(lot.id, { ...item, count: plan.remainingCount }, plan);
    }
    if (lot.currentBidderId !== null && plan.bidderRefund > 0) {
      await tx.creditOverflowMoney(lot.currentBidderId, plan.bidderRefund);
    }
    await tx.debitBuyer(input.buyerId, plan.cost);
    await tx.creditSeller(lot.sellerId, plan.payout);
    await tx.addTreasuryCommission(plan.commission, 'auction_partial');
    await tx.insertHistory({
      sellerId: lot.sellerId,
      buyerId: input.buyerId,
      itemName: String(item.name || 'Предмет'),
      itemData: JSON.stringify({ ...item, count: input.quantity }),
      price: plan.cost,
      commission: plan.commission,
      createdAt: new Date(input.now * 1000).toISOString(),
    });
    return {
      ...plan,
      lotId: lot.id,
      sellerId: lot.sellerId,
      buyerId: input.buyerId,
      itemName: String(item.name || 'Предмет'),
    };
  });
}
