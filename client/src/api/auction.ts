import { BASE_URL, getHeaders } from './helpers';
import { normalizeItem } from '../domain/items/normalizeItem';
import type { GameItem } from '../types/items';

export interface AuctionLot {
  id: number;
  itemData: GameItem;
  [key: string]: unknown;
}

export interface AuctionGroup {
  item: GameItem;
  [key: string]: unknown;
}

export interface AuctionHistoryEntry {
  id: number;
  itemData: GameItem | null;
  [key: string]: unknown;
}

export interface AuctionResponse {
  lots: AuctionLot[];
  groups: AuctionGroup[];
  totalCount?: number;
  totalPages?: number;
  page?: number;
  myLotCount?: number;
  groupTotalCount?: number;
  groupTotalPages?: number;
  groupPage?: number;
  [key: string]: unknown;
}

export interface AuctionHistoryResponse {
  history: AuctionHistoryEntry[];
  page?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export interface AuctionPricePoint {
  day: string;
  avg_price: number;
  min_price: number;
  max_price: number;
}

function recordOr(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch { /* invalid item data becomes an empty item */ }
  }
  return {};
}

function validItemRecord(value: unknown): Record<string, unknown> | null {
  const item = recordOr(value);
  return typeof item.name === 'string' && item.name.trim() ? item : null;
}

export function normalizeAuctionLot(raw: unknown): AuctionLot | null {
  const lot = recordOr(raw);
  const id = Number(lot.id);
  const itemData = validItemRecord(lot.itemData);
  if (!Number.isInteger(id) || id <= 0 || !itemData) return null;
  return {
    ...lot,
    id,
    itemData: normalizeItem(itemData),
  } as AuctionLot;
}

export function normalizeAuctionResponse(raw: unknown): AuctionResponse {
  const data = recordOr(raw);
  const lots = Array.isArray(data.lots)
    ? data.lots.map(normalizeAuctionLot).filter((lot): lot is AuctionLot => lot !== null)
    : [];
  const groups = Array.isArray(data.groups)
    ? data.groups.flatMap(rawGroup => {
        const group = recordOr(rawGroup);
        const item = validItemRecord(group.item);
        return item ? [{ ...group, item: normalizeItem(item) } as AuctionGroup] : [];
      })
    : [];
  return { ...data, lots, groups } as AuctionResponse;
}

export function normalizeAuctionHistoryResponse(raw: unknown): AuctionHistoryResponse {
  const data = recordOr(raw);
  const history = Array.isArray(data.history)
    ? data.history.map(rawEntry => {
        const entry = recordOr(rawEntry);
        return {
          ...entry,
          id: Number(entry.id) || 0,
          itemData: entry.itemData == null ? null : normalizeItem(recordOr(entry.itemData)),
        } as AuctionHistoryEntry;
      })
    : [];
  return { ...data, history } as AuctionHistoryResponse;
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, { headers: getHeaders() });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Сервер вернул некорректный ответ');
  }
  if (!response.ok) {
    const error = recordOr(data);
    throw new Error(String(error.error || 'Не удалось загрузить данные аукциона'));
  }
  return data;
}

export async function fetchAuction(query: URLSearchParams) {
  return normalizeAuctionResponse(await getJson(`/auction?${query}`));
}

export async function fetchAuctionHistory(page: number, limit = 10) {
  return normalizeAuctionHistoryResponse(await getJson(`/auction/history?page=${page}&limit=${limit}`));
}

export async function fetchMyAuctionLots() {
  return normalizeAuctionResponse(await getJson('/auction/my-lots'));
}

export async function fetchAuctionPriceHistory(item: GameItem): Promise<AuctionPricePoint[]> {
  const query = new URLSearchParams({
    name: item.name || '',
    slot: item.slot || '',
    rarity: String(item.rarity_id ?? 0),
    upgradeLevel: String(item.upgradeLevel ?? 0),
  });
  const data = recordOr(await getJson(`/auction/price-history?${query}`));
  return Array.isArray(data.points) ? data.points as AuctionPricePoint[] : [];
}
