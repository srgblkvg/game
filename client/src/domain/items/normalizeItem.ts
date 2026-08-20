import type { GameItem } from '../../types/items';

type RawItem = Record<string, unknown>;

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function objectOr<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as T;
    } catch { /* keep fallback */ }
  }
  return fallback;
}

export function normalizeItem(raw: RawItem): GameItem {
  const rarityId = raw.rarity_id ?? raw.rarityId ?? raw.rarity;
  const upgradeLevel = raw.upgradeLevel ?? raw.upgradelevel;
  const count = Math.max(1, numberOr(raw.count, 1));

  return {
    ...raw,
    id: raw.id ?? '',
    name: String(raw.name ?? 'Предмет'),
    ...(rarityId === undefined ? {} : { rarity_id: numberOr(rarityId, 0) }),
    ...(upgradeLevel === undefined ? {} : { upgradeLevel: numberOr(upgradeLevel, 0) }),
    count,
    bonuses: objectOr(raw.bonuses, {}),
    extra: objectOr(raw.extra, {}),
  } as GameItem;
}

export function normalizeItems(items: unknown): GameItem[] {
  if (!Array.isArray(items)) return [];
  return items.filter(Boolean).map(item => normalizeItem(item as RawItem));
}
