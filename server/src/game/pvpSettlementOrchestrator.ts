export async function runSettlementAndEffects<T>(
  settle: () => Promise<T>,
  effects: (result: T) => Promise<void> | void,
): Promise<T> {
  const result = await settle();
  await effects(result);
  return result;
}
