export interface AuctionBuyoutLot {
  id: number;
  sellerId: number;
  currentBidderId: number | null;
  currentBid: number | null;
  buyoutPrice: number | null;
  itemData: string | Record<string, unknown>;
  endsAt: number;
}

export interface AuctionBuyoutBuyer {
  id: number;
  money: number;
  username: string;
}

export interface AuctionBuyoutHistoryEntry {
  sellerId: number;
  buyerId: number;
  itemName: string;
  itemData: string;
  price: number;
  commission: number;
  createdAt: string;
}

export interface AuctionBuyoutMessage {
  lotId: number;
  item: Record<string, unknown>;
  price: number;
  buyerName: string;
  sellerName: string;
  createdAt: string;
}

export interface AuctionBuyoutTransaction {
  lockActiveLot(lotId: number, now: number): Promise<AuctionBuyoutLot | null>;
  lockBuyer(userId: number): Promise<AuctionBuyoutBuyer | null>;
  getUsername(userId: number): Promise<string | null>;
  creditOverflowMoney(userId: number, amount: number): Promise<void>;
  addOverflowItem(userId: number, item: Record<string, unknown>, auctionLotId: number): Promise<void>;
  debitBuyer(userId: number, amount: number): Promise<void>;
  creditSeller(userId: number, amount: number): Promise<void>;
  addTreasuryCommission(amount: number, source: string): Promise<void>;
  insertHistory(entry: AuctionBuyoutHistoryEntry): Promise<void>;
  incrementSellerSales(userId: number): Promise<void>;
  deleteAuctionMessages(lotId: number): Promise<void>;
  deleteLot(lotId: number): Promise<void>;
  insertBuyoutMessage(message: AuctionBuyoutMessage): Promise<number>;
}

export interface AuctionBuyoutRepository {
  transaction<T>(callback: (tx: AuctionBuyoutTransaction) => Promise<T>): Promise<T>;
}

export interface AuctionBuyoutResult {
  lotId: number;
  buyerId: number;
  sellerId: number;
  item: Record<string, unknown>;
  itemName: string;
  buyerName: string;
  sellerName: string;
  price: number;
  commission: number;
  payout: number;
  chatMessageId: number;
  createdAt: string;
}

export interface AuctionBuyoutEffects {
  committed(result: AuctionBuyoutResult): void;
}

function parseItem(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== 'string') return { ...value };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Некорректные данные предмета аукционного лота');
  }
  return { ...(parsed as Record<string, unknown>) };
}

export async function buyoutAuctionLot(
  repository: AuctionBuyoutRepository,
  effects: AuctionBuyoutEffects,
  input: { lotId: number; buyerId: number; now: number },
): Promise<AuctionBuyoutResult> {
  const committed = await repository.transaction(async (tx) => {
    const lot = await tx.lockActiveLot(input.lotId, input.now);
    if (!lot) throw new Error('Лот не найден');
    if (lot.buyoutPrice === null) throw new Error('У лота нет выкупа');
    if (lot.sellerId === input.buyerId) throw new Error('Нельзя купить свой лот');

    const buyer = await tx.lockBuyer(input.buyerId);
    if (!buyer || buyer.money < lot.buyoutPrice) throw new Error('Недостаточно монет');

    const item = parseItem(lot.itemData);
    const itemName = String(item.name || 'Предмет');
    const commission = Math.floor(lot.buyoutPrice * 0.1);
    const payout = lot.buyoutPrice - commission;
    const createdAt = new Date(input.now * 1000).toISOString();
    const sellerName = (await tx.getUsername(lot.sellerId)) || 'Кто-то';

    if (lot.currentBidderId !== null && lot.currentBid !== null) {
      await tx.creditOverflowMoney(lot.currentBidderId, lot.currentBid);
    }
    await tx.addOverflowItem(input.buyerId, item, lot.id);
    await tx.debitBuyer(input.buyerId, lot.buyoutPrice);
    await tx.creditSeller(lot.sellerId, payout);
    await tx.addTreasuryCommission(commission, 'auction_buyout');
    await tx.insertHistory({
      sellerId: lot.sellerId,
      buyerId: input.buyerId,
      itemName,
      itemData: typeof lot.itemData === 'string' ? lot.itemData : JSON.stringify(lot.itemData),
      price: lot.buyoutPrice,
      commission,
      createdAt,
    });
    await tx.incrementSellerSales(lot.sellerId);
    await tx.deleteAuctionMessages(lot.id);
    await tx.deleteLot(lot.id);
    const chatMessageId = await tx.insertBuyoutMessage({
      lotId: lot.id,
      item,
      price: lot.buyoutPrice,
      buyerName: buyer.username,
      sellerName,
      createdAt,
    });

    return {
      lotId: lot.id,
      buyerId: input.buyerId,
      sellerId: lot.sellerId,
      item,
      itemName,
      buyerName: buyer.username,
      sellerName,
      price: lot.buyoutPrice,
      commission,
      payout,
      chatMessageId,
      createdAt,
    };
  });

  try {
    effects.committed(committed);
  } catch (error) {
    console.error('[auction-buyout] post-commit effect failed:', error);
  }
  return committed;
}
