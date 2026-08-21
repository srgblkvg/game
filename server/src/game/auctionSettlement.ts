export interface ExpiredAuctionLot {
  id: number;
  sellerId: number;
  currentBidderId: number | null;
  currentBid: number | null;
  itemData: string | Record<string, unknown>;
  endsAt: number;
}

export interface AuctionHistoryEntry {
  sellerId: number;
  buyerId: number;
  itemName: string;
  itemData: string;
  price: number;
  commission: number;
  createdAt: string;
}

export interface AuctionSettlementResult {
  lotId: number;
  sellerId: number;
  buyerId: number | null;
  itemName: string;
  price: number | null;
  commission: number;
}

export interface AuctionSettlementTransaction {
  lockExpiredLot(lotId: number, now: number): Promise<ExpiredAuctionLot | null>;
  creditOverflowMoney(userId: number, amount: number): Promise<void>;
  addOverflowItem(userId: number, item: Record<string, unknown>, auctionLotId: number): Promise<void>;
  insertHistory(entry: AuctionHistoryEntry): Promise<void>;
  addTreasuryCommission(amount: number, source: string): Promise<void>;
  incrementSellerTrade(userId: number): Promise<void>;
  deleteAuctionMessages(lotId: number): Promise<void>;
  deleteLot(lotId: number): Promise<void>;
  getUsername(userId: number): Promise<string | null>;
}

export interface AuctionSettlementRepository {
  findExpiredLotIds(now: number): Promise<number[]>;
  transaction<T>(callback: (tx: AuctionSettlementTransaction) => Promise<T>): Promise<T>;
}

export interface AuctionSettlementEffects {
  sold(result: AuctionSettlementResult & { buyerName: string }): void;
  unsold(result: AuctionSettlementResult): void;
}

export interface AuctionSettlementBatchResult {
  settled: number;
  skipped: number;
  failed: number;
}

function parseItemData(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== 'string') return { ...value };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Некорректные данные предмета аукционного лота');
  }
  return { ...(parsed as Record<string, unknown>) };
}

export async function settleExpiredAuctions(
  repository: AuctionSettlementRepository,
  effects: AuctionSettlementEffects,
  now: number,
): Promise<AuctionSettlementBatchResult> {
  const lotIds = await repository.findExpiredLotIds(now);
  const result: AuctionSettlementBatchResult = { settled: 0, skipped: 0, failed: 0 };

  for (const lotId of lotIds) {
    let settled: (AuctionSettlementResult & { buyerName?: string }) | null = null;
    try {
      settled = await repository.transaction(async (tx) => {
        const lot = await tx.lockExpiredLot(lotId, now);
        if (!lot) return null;

        const item = parseItemData(lot.itemData);
        if (lot.currentBidderId !== null && lot.currentBid !== null) {
          const commission = Math.floor(lot.currentBid * 0.1);
          await tx.creditOverflowMoney(lot.sellerId, lot.currentBid - commission);
          await tx.addOverflowItem(lot.currentBidderId, item, lot.id);
          await tx.insertHistory({
            sellerId: lot.sellerId,
            buyerId: lot.currentBidderId,
            itemName: String(item.name || 'Предмет'),
            itemData: typeof lot.itemData === 'string' ? lot.itemData : JSON.stringify(lot.itemData),
            price: lot.currentBid,
            commission,
            createdAt: new Date(now * 1000).toISOString(),
          });
          await tx.addTreasuryCommission(commission, 'auction_expired');
          await tx.incrementSellerTrade(lot.sellerId);
          await tx.deleteAuctionMessages(lot.id);
          await tx.deleteLot(lot.id);
          return {
            lotId: lot.id,
            sellerId: lot.sellerId,
            buyerId: lot.currentBidderId,
            itemName: String(item.name || 'Предмет'),
            price: lot.currentBid,
            commission,
            buyerName: (await tx.getUsername(lot.currentBidderId)) || 'Кто-то',
          };
        }

        await tx.addOverflowItem(lot.sellerId, item, lot.id);
        await tx.deleteAuctionMessages(lot.id);
        await tx.deleteLot(lot.id);
        return {
          lotId: lot.id,
          sellerId: lot.sellerId,
          buyerId: null,
          itemName: String(item.name || 'Предмет'),
          price: null,
          commission: 0,
        };
      });
    } catch {
      result.failed += 1;
      continue;
    }

    if (!settled) {
      result.skipped += 1;
      continue;
    }
    result.settled += 1;
    if (settled.buyerId === null) {
      effects.unsold(settled);
    } else {
      effects.sold({ ...settled, buyerName: settled.buyerName || 'Кто-то' });
    }
  }

  return result;
}
