export interface OverflowStack {
  id: number;
  item: string | Record<string, unknown>;
}

export interface OverflowAddTransaction {
  lockUser(userId: number): Promise<boolean>;
  lockStack(userId: number, itemId: string, type: string): Promise<OverflowStack | null>;
  updateStack(id: number, item: Record<string, unknown>): Promise<void>;
  insertItem(userId: number, item: Record<string, unknown>, auctionLotId?: number): Promise<void>;
}

export interface OverflowAddRepository {
  transaction<T>(callback: (tx: OverflowAddTransaction) => Promise<T>): Promise<T>;
}

function parseItem(value: string | Record<string, unknown>): Record<string, unknown> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Некорректные данные предмета');
  return { ...(parsed as Record<string, unknown>) };
}

function isStackable(item: Record<string, unknown>): boolean {
  return item.type === 'craft_item' || item.type === 'material' || item.type === 'upgrade';
}

function countOf(item: Record<string, unknown>, fallback: number): number {
  const count = item.count === undefined ? fallback : Number(item.count);
  if (!Number.isInteger(count) || count < (fallback === 1 ? 1 : 0)) throw new Error('Некорректное количество предмета');
  return count;
}

export async function addOverflowItem(
  repository: OverflowAddRepository,
  input: { userId: number; item: string | Record<string, unknown>; auctionLotId?: number },
): Promise<void> {
  await repository.transaction(async tx => {
    if (!await tx.lockUser(input.userId)) throw new Error('Пользователь не найден');
    const item = parseItem(input.item);
    if (isStackable(item)) {
      const incoming = countOf(item, 1);
      const existing = await tx.lockStack(input.userId, String(item.id), String(item.type));
      if (existing) {
        const current = parseItem(existing.item);
        current.count = countOf(current, 0) + incoming;
        await tx.updateStack(existing.id, current);
        return;
      }
    }
    await tx.insertItem(input.userId, item, input.auctionLotId);
  });
}
