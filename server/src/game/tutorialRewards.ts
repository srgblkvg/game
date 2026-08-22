export interface TutorialRewardOwner {
  id: number;
  tutorialStep: number;
  tutorialCompleted?: number;
  money: number;
  inventory: string | Record<string, any>[];
}

export interface TutorialRewardTransaction {
  lockUser(userId: number): Promise<TutorialRewardOwner | null>;
  savePveReward(
    userId: number,
    inventory: Record<string, any>[],
    money: number,
    tutorialStep: number,
    lastPveAttackTime: number,
  ): Promise<void>;
  saveCraftReward(
    userId: number,
    inventory: Record<string, any>[],
    tutorialStep: number,
  ): Promise<void>;
  saveCompletion(userId: number, money: number, tutorialStep: number, completed: number): Promise<void>;
}

export interface TutorialRewardRepository {
  transaction<T>(callback: (tx: TutorialRewardTransaction) => Promise<T>): Promise<T>;
}

function parseInventory(value: TutorialRewardOwner['inventory']): Record<string, any>[] {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '[]') : value;
  if (!Array.isArray(parsed)) throw new Error('Некорректный инвентарь');
  return parsed.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error('Некорректный предмет в инвентаре');
    }
    return { ...item };
  });
}

export async function grantTutorialPveReward(
  repository: TutorialRewardRepository,
  input: {
    userId: number;
    sword: Record<string, any>;
    dust: Record<string, any>;
    now: number;
  },
): Promise<{ inventory: Record<string, any>[]; money: number }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    if (Number(owner.tutorialStep || 0) !== 0) throw new Error('Неверный шаг обучения');

    const inventory = parseInventory(owner.inventory);
    const existingDust = inventory.find(item =>
      item.type === 'craft_item' && item.id === input.dust.id
    );
    if (existingDust) {
      existingDust.count = Number(existingDust.count || 0) + Number(input.dust.count || 1);
    } else {
      inventory.push({ ...input.dust, count: Number(input.dust.count || 1) });
    }
    inventory.push({ ...input.sword });
    const money = Number(owner.money || 0) + 5;
    await tx.savePveReward(input.userId, inventory, money, 1, input.now);
    return { inventory, money };
  });
}

export async function grantTutorialCraftReward(
  repository: TutorialRewardRepository,
  input: { userId: number; shield: Record<string, any>; dustId: string | number },
): Promise<{ inventory: Record<string, any>[] }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    if (Number(owner.tutorialStep || 0) !== 2) throw new Error('Неверный шаг обучения');

    const inventory = parseInventory(owner.inventory);
    const dustIndex = inventory.findIndex(item =>
      item.type === 'craft_item' && item.id === input.dustId
    );
    if (dustIndex === -1) throw new Error('Нет Пыли забвения в инвентаре');
    const dust = inventory[dustIndex]!;
    if (Number(dust.count) > 1) {
      inventory[dustIndex] = { ...dust, count: Number(dust.count) - 1 };
    } else {
      inventory.splice(dustIndex, 1);
    }
    inventory.push({ ...input.shield });
    await tx.saveCraftReward(input.userId, inventory, 3);
    return { inventory };
  });
}

export async function completeTutorial(
  repository: TutorialRewardRepository,
  input: { userId: number; reward: number; requiredStep?: number },
): Promise<{ reward: number; money: number; completed: true }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    if (Number(owner.tutorialCompleted || 0) === 1) {
      return { reward: 0, money: Number(owner.money || 0), completed: true };
    }
    const requiredStep = input.requiredStep ?? 5;
    if (Number(owner.tutorialStep || 0) !== requiredStep) throw new Error('Неверный шаг обучения');
    const reward = Number(input.reward);
    if (!Number.isFinite(reward) || reward < 0) throw new Error('Некорректная награда');
    const money = Number(owner.money || 0) + reward;
    await tx.saveCompletion(input.userId, money, 6, 1);
    return { reward, money, completed: true };
  });
}

export async function skipTutorial(
  repository: TutorialRewardRepository,
  input: { userId: number },
): Promise<{ reward: 0; money: number; completed: true }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    const money = Number(owner.money || 0);
    if (Number(owner.tutorialCompleted || 0) !== 1) {
      await tx.saveCompletion(input.userId, money, 6, 1);
    }
    return { reward: 0, money, completed: true };
  });
}
