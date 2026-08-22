export interface EquipmentSwitchOwner {
  id: number;
  activeEquipSlot: number;
  equipment: Record<string, any>;
  equipmentSets: Record<number, Record<string, any>>;
}

export interface EquipmentSwitchState {
  userId: number;
  oldSlot: number;
  newSlot: number;
  oldEquipment: Record<string, any>;
  newEquipment: Record<string, any>;
}

export interface EquipmentSwitchTransaction {
  lockUser(userId: number): Promise<EquipmentSwitchOwner | null>;
  saveSwitch(state: EquipmentSwitchState): Promise<void>;
}

export interface EquipmentSwitchRepository {
  transaction<T>(callback: (tx: EquipmentSwitchTransaction) => Promise<T>): Promise<T>;
}

export interface EquipmentSwitchResult {
  success: true;
  activeEquipSlot: number;
  equipment: Record<string, any>;
}

export async function switchEquipmentSet(
  repository: EquipmentSwitchRepository,
  input: { userId: number; slot: number },
): Promise<EquipmentSwitchResult> {
  if (![1, 2, 3].includes(input.slot)) throw new Error('Неверный слот');

  return repository.transaction(async tx => {
    const user = await tx.lockUser(input.userId);
    if (!user) throw new Error('User not found');

    const activeSet = user.equipmentSets[user.activeEquipSlot] || {};
    const currentEquipment = Object.keys(activeSet).length > 0 ? activeSet : user.equipment;

    if (user.activeEquipSlot === input.slot) {
      return { success: true, activeEquipSlot: input.slot, equipment: structuredClone(currentEquipment) };
    }

    const targetEquipment = structuredClone(user.equipmentSets[input.slot] || {});
    await tx.saveSwitch({
      userId: input.userId,
      oldSlot: user.activeEquipSlot,
      newSlot: input.slot,
      oldEquipment: structuredClone(currentEquipment),
      newEquipment: targetEquipment,
    });

    return { success: true, activeEquipSlot: input.slot, equipment: targetEquipment };
  });
}
