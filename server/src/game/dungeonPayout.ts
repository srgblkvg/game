export interface DungeonLoot {
  silver: number;
  items: Record<string, any>[];
  pages: Array<{ skillId: number }>;
}

export interface DungeonPayoutOwner {
  id: number;
  inventory: string | Record<string, any>[];
  money: number;
}

export interface DungeonPayoutTransaction {
  lockUser(userId: number): Promise<DungeonPayoutOwner | null>;
  saveUserReward(userId: number, money: number, inventory: Record<string, any>[]): Promise<void>;
  addSkillPage(userId: number, skillId: number): Promise<void>;
  updateRunProgress(userId: number, startedAt: number, maxFloor: number, maxReward: number): Promise<void>;
}

export interface DungeonPayoutRepository {
  transaction<T>(callback: (tx: DungeonPayoutTransaction) => Promise<T>): Promise<T>;
}

export function restartDungeonRunAfterFailedPayout<TTimer>(
  run: { tickTimer: TTimer | null },
  startTimer: () => TTimer,
): void {
  run.tickTimer = startTimer();
}

function parseInventory(value: DungeonPayoutOwner['inventory']): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Некорректный предмет в инвентаре');
    }
    return { ...item };
  });
}

export async function payDungeonLoot(
  repository: DungeonPayoutRepository,
  input: {
    userId: number;
    loot: DungeonLoot;
    currentFloor: number;
    startedAt: number;
  },
): Promise<{ money: number; inventory: Record<string, any>[] }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error(`Пользователь ${input.userId} не найден`);

    const inventory = parseInventory(owner.inventory);
    for (const sourceItem of input.loot.items) {
      const item = { ...sourceItem };
      if (item.type === 'craft_item') {
        const count = Math.max(1, Number(item.count) || 0);
        const existing = inventory.find(candidate =>
          candidate.type === 'craft_item' && candidate.id === item.id
        );
        if (existing) {
          existing.count = Math.max(1, Number(existing.count) || 0) + count;
        } else {
          inventory.push({ ...item, count });
        }
      } else {
        inventory.push(item);
      }
    }

    const silver = Number(input.loot.silver) || 0;
    const money = Number(owner.money) + silver;
    await tx.saveUserReward(input.userId, money, inventory);
    for (const page of input.loot.pages) {
      await tx.addSkillPage(input.userId, page.skillId);
    }
    await tx.updateRunProgress(
      input.userId,
      input.startedAt,
      input.currentFloor,
      silver,
    );
    return { money, inventory };
  });
}
