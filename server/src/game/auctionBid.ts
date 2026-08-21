export interface AuctionBidLot {
  id: number;
  sellerId: number;
  startPrice: number;
  buyoutPrice: number | null;
  currentBid: number | null;
  currentBidderId: number | null;
  itemData: string | Record<string, unknown>;
  endsAt: number;
}

export interface AuctionBidMessage {
  lotId: number;
  item: Record<string, unknown>;
  startPrice: number;
  currentBid: number;
  buyoutPrice: number | null;
  bidderName: string;
  previousBidderName: string | null;
  sellerName: string;
  endsAt: number;
  createdAt: string;
}

export interface AuctionBidTransaction {
  lockActiveLot(lotId: number, now: number): Promise<AuctionBidLot | null>;
  lockBidder(userId: number): Promise<{ money: number; username: string } | null>;
  getUsername(userId: number): Promise<string | null>;
  creditOverflowMoney(userId: number, amount: number): Promise<void>;
  debitBidder(userId: number, amount: number): Promise<void>;
  updateBid(lotId: number, amount: number, bidderId: number): Promise<void>;
  insertBidMessage(message: AuctionBidMessage): Promise<number>;
}

export interface AuctionBidRepository {
  transaction<T>(callback: (tx: AuctionBidTransaction) => Promise<T>): Promise<T>;
}

export interface AuctionBidResult extends AuctionBidMessage {
  bidderId: number;
  sellerId: number;
  previousBidderId: number | null;
  chatMessageId: number;
}

function parseItem(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== 'string') return { ...value };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Некорректные данные предмета');
  return { ...(parsed as Record<string, unknown>) };
}

export async function placeAuctionBid(
  repository: AuctionBidRepository,
  input: { lotId: number; bidderId: number; amount: number; now: number },
): Promise<AuctionBidResult> {
  return repository.transaction(async (tx) => {
    const lot = await tx.lockActiveLot(input.lotId, input.now);
    if (!lot) throw new Error('Лот не найден или истёк');
    if (lot.sellerId === input.bidderId) throw new Error('Нельзя ставить на свой лот');

    const minBid = lot.currentBid === null
      ? lot.startPrice
      : lot.currentBid + Math.max(1, Math.floor(lot.currentBid * 0.05));
    if (input.amount < minBid) throw new Error(`Мин. ставка: ${minBid} серебра`);

    const bidder = await tx.lockBidder(input.bidderId);
    if (!bidder || bidder.money < input.amount) throw new Error('Недостаточно монет');
    const previousBidderId = lot.currentBidderId;
    const previousBidderName = previousBidderId === null
      ? null
      : (await tx.getUsername(previousBidderId)) || 'Кто-то';
    const sellerName = (await tx.getUsername(lot.sellerId)) || 'Кто-то';

    if (previousBidderId !== null && lot.currentBid !== null) {
      await tx.creditOverflowMoney(previousBidderId, lot.currentBid);
    }
    await tx.debitBidder(input.bidderId, input.amount);
    await tx.updateBid(lot.id, input.amount, input.bidderId);
    const createdAt = new Date(input.now * 1000).toISOString();
    const message = {
      lotId: lot.id,
      item: parseItem(lot.itemData),
      startPrice: lot.startPrice,
      currentBid: input.amount,
      buyoutPrice: lot.buyoutPrice,
      bidderName: bidder.username,
      previousBidderName,
      sellerName,
      endsAt: lot.endsAt,
      createdAt,
    };
    const chatMessageId = await tx.insertBidMessage(message);
    return {
      ...message,
      bidderId: input.bidderId,
      sellerId: lot.sellerId,
      previousBidderId,
      chatMessageId,
    };
  });
}
