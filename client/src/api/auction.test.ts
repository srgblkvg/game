/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  fetchAuction,
  fetchAuctionPriceHistory,
  normalizeAuctionHistoryResponse,
  normalizeAuctionLot,
  normalizeAuctionResponse,
} from './auction.ts';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  },
});

test('нормализует строковый itemData лота без изменения исходного объекта', () => {
  const source = {
    id: '17',
    itemData: JSON.stringify({ id: 4, name: 'Меч', rarityId: '3', upgradelevel: '7', bonuses: '{"s":5}' }),
  };
  const lot = normalizeAuctionLot(source);

  assert.ok(lot);
  assert.equal(lot.id, 17);
  assert.equal(lot.itemData.rarity_id, 3);
  assert.equal(lot.itemData.upgradeLevel, 7);
  assert.deepEqual(lot.itemData.bonuses, { s: 5 });
  assert.equal(typeof source.itemData, 'string');
});

test('нормализует предметы лотов и групп, сохраняя пагинацию', () => {
  const data = normalizeAuctionResponse({
    lots: [{ id: 1, itemData: { id: 2, name: 'Руна', count: '4' } }],
    groups: [{ item: { id: 3, name: 'Щит', rarity: '2' }, count: 5 }],
    totalPages: 3,
    myLotCount: 8,
  });

  assert.equal(data.lots[0]?.itemData.count, 4);
  assert.equal(data.groups[0]?.item.rarity_id, 2);
  assert.equal(data.totalPages, 3);
  assert.equal(data.myLotCount, 8);
});

test('нормализует историю и безопасно обрабатывает неверную форму ответа', () => {
  const data = normalizeAuctionHistoryResponse({
    history: [
      { id: 1, itemData: '{"id":9,"name":"Амулет","upgradelevel":"3"}' },
      { id: 2, itemData: null },
    ],
  });
  assert.equal(data.history[0]?.itemData?.upgradeLevel, 3);
  assert.equal(data.history[1]?.itemData, null);
  assert.deepEqual(normalizeAuctionResponse({ lots: {}, groups: null }).lots, []);
  assert.deepEqual(normalizeAuctionHistoryResponse({ history: 'error' }).history, []);
});

test('сообщает о некорректном HTML-ответе вместо падения на JSON.parse', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('<html>503</html>', { status: 503 });
  try {
    await assert.rejects(fetchAuction(new URLSearchParams()), /Сервер вернул некорректный ответ/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('сохраняет текст серверной JSON-ошибки', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Аукцион временно недоступен' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });
  try {
    await assert.rejects(fetchAuction(new URLSearchParams()), /Аукцион временно недоступен/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('отбрасывает повреждённые торговые лоты и группы', () => {
  const data = normalizeAuctionResponse({
    lots: [
      { id: 0, itemData: { name: 'Нет ID' } },
      { id: 7, itemData: '{invalid' },
      { id: 8, itemData: { name: 'Рабочий предмет' } },
    ],
    groups: [{ item: null }, { item: { name: 'Рабочая группа' } }],
  });

  assert.deepEqual(data.lots.map(lot => lot.id), [8]);
  assert.deepEqual(data.groups.map(group => group.item.name), ['Рабочая группа']);
});

test('история цен использует общую безопасную HTTP-границу', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ points: [{ day: '2026-08-21', avg_price: 10, min_price: 8, max_price: 12 }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  try {
    const points = await fetchAuctionPriceHistory({ id: 'test-item', name: 'Меч' });
    assert.equal(points[0]?.avg_price, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('история цен не скрывает HTTP-ошибку как пустой график', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'История недоступна' }), {
    status: 503,
    headers: { 'content-type': 'application/json' },
  });
  try {
    await assert.rejects(fetchAuctionPriceHistory({ id: 'test-item', name: 'Меч' }), /История недоступна/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
