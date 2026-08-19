export interface ItemUpgradeLevelLike {
  upgradeLevel?: unknown;
  upgradelevel?: unknown;
}

export function getItemUpgradeLevel(item: ItemUpgradeLevelLike | null | undefined): number {
  const value = Number(item?.upgradeLevel ?? item?.upgradelevel ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
