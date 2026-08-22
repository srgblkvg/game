export interface TutorialProgressOwner {
  id: number;
  tutorialStep: number;
  activeEquipSlot: number;
  equipment: string | Record<string, any>;
  equipment1: string | Record<string, any>;
  equipment2: string | Record<string, any>;
  equipment3: string | Record<string, any>;
}

export interface TutorialProgressTransaction {
  lockUser(userId: number): Promise<TutorialProgressOwner | null>;
  saveStep(userId: number, step: number): Promise<void>;
  saveArenaStep(userId: number, step: number, lastPvpTime: number): Promise<void>;
}

export interface TutorialProgressRepository {
  transaction<T>(callback: (tx: TutorialProgressTransaction) => Promise<T>): Promise<T>;
}

function parseEquipment(value: string | Record<string, any>): Record<string, any> {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value || '{}') : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return parsed as Record<string, any>;
}

function activeEquipment(owner: TutorialProgressOwner): Record<string, any> {
  const slot = [1, 2, 3].includes(Number(owner.activeEquipSlot)) ? Number(owner.activeEquipSlot) : 1;
  const selected = parseEquipment(slot === 1 ? owner.equipment1 : slot === 2 ? owner.equipment2 : owner.equipment3);
  return Object.keys(selected).length > 0 ? selected : parseEquipment(owner.equipment);
}

export async function advanceTutorialEquipmentStep(
  repository: TutorialProgressRepository,
  input: {
    userId: number;
    expectedStep: number;
    nextStep: number;
    requiredSlot: string;
    missingMessage: string;
  },
): Promise<{ success: true; nextStep: number }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    if (Number(owner.tutorialStep || 0) !== input.expectedStep) {
      throw new Error('Неверный шаг обучения');
    }
    if (!activeEquipment(owner)[input.requiredSlot]) throw new Error(input.missingMessage);
    await tx.saveStep(input.userId, input.nextStep);
    return { success: true, nextStep: input.nextStep };
  });
}

export async function advanceTutorialArenaStep(
  repository: TutorialProgressRepository,
  input: { userId: number; now: number },
): Promise<{ success: true; nextStep: 5 }> {
  return repository.transaction(async tx => {
    const owner = await tx.lockUser(input.userId);
    if (!owner) throw new Error('User not found');
    if (Number(owner.tutorialStep || 0) !== 4) throw new Error('Неверный шаг обучения');
    await tx.saveArenaStep(input.userId, 5, input.now);
    return { success: true, nextStep: 5 };
  });
}
