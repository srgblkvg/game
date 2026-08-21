export interface AuctionCancelLot {
  id: number;
  sellerId: number;
  currentBidderId: number | null;
  currentBid: number | null;
  itemData: string | Record<string, unknown>;
}

export interface AuctionCancelTransaction {
  lockActiveLot(lotId: number, now: number): Promise<AuctionCancelLot | null>;
  addOverflowItem(userId: number, item: Record<string, unknown>, auctionLotId: number): Promise<void>;
  creditOverflowMoney(userId: number, amount: number): Promise<void>;
  deleteAuctionMessages(lotId: number): Promise<void>;
  deleteLot(lotId: number): Promise<void>;
}

export interface AuctionCancelRepository {
  transaction<T>(callback: (tx: AuctionCancelTransaction) => Promise<T>): Promise<T>;
}

export interface AuctionCancelResult {
  lotId: number;
  sellerId: number;
  itemName: string;
}

export interface AuctionCancelEffects {
  committed(result: AuctionCancelResult): void;
}

function parseItem(value: string | Record<string, unknown>): Record<string, unknown> {
  if (typeof value !== 'string') return { ...value };
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Некорректные данные предмета аукционного лота');
  }
  return { ...(parsed as Record<string, unknown>) };
}

export async function cancelAuctionLot(
  repository: AuctionCancelRepository,
  effects: AuctionCancelEffects,
  input: { lotId: number; sellerId: number; now: number },
): Promise<AuctionCancelResult> {
  const result = await repository.transaction(async (tx) => {
    const lot = await tx.lockActiveLot(input.lotId, input.now);
    if (!lot) throw new Error('Лот не найден или истёк');
    if (lot.sellerId !== input.sellerId) throw new Error('Это не ваш лот');

    const item = parseItem(lot.itemData);
    await tx.addOverflowItem(input.sellerId, item, lot.id);
    if (lot.currentBidderId !== null && lot.currentBid !== null) {
      await tx.creditOverflowMoney(lot.currentBidderId, lot.currentBid);
    }
    await tx.deleteAuctionMessages(lot.id);
    await tx.deleteLot(lot.id);
    return { lotId: lot.id, sellerId: input.sellerId, itemName: String(item.name || 'Предмет') };
  });

  try {
    effects.committed(result);
  } catch (error) {
    console.error('[auction-cancel] post-commit effect failed:', error);
  }
  return result;
}
