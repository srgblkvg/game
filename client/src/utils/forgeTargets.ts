export function applyCommonForgeTarget(
  items: Record<string, number>,
  selectedIds: string[],
  targetLevel: number,
  currentLevels: Record<string, number>,
): Record<string, number> {
  const next = { ...items };
  for (const id of selectedIds) {
    const current = Number(currentLevels[id] || 0);
    if (targetLevel > current) next[id] = Math.min(10, targetLevel);
  }
  return next;
}

export function getCommonForgeTargetOptions(currentLevels: Record<string, number>, selectedIds: string[]): number[] {
  const minCurrent = Math.min(...selectedIds.map(id => Number(currentLevels[id] || 0)));
  if (!Number.isFinite(minCurrent)) return [];
  return Array.from({ length: 10 - minCurrent }, (_, index) => minCurrent + index + 1);
}
