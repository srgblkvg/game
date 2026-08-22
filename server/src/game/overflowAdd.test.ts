/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { addOverflowItem, type OverflowAddRepository, type OverflowAddTransaction } from './overflowAdd';

function repository(existing: Record<string, unknown> | null = null) {
  const calls: string[] = [];
  let updated: Record<string, unknown> | null = null;
  let inserted: Record<string, unknown> | null = null;
  const tx: OverflowAddTransaction = {
    async lockUser(userId) { calls.push(`lock-user:${userId}`); return true; },
    async lockStack(userId, itemId, type) {
      calls.push(`lock-stack:${userId}:${itemId}:${type}`);
      return existing ? { id: 5, item: existing } : null;
    },
    async updateStack(id, item) { calls.push(`update:${id}`); updated = structuredClone(item); },
    async insertItem(userId, item, auctionLotId) {
      calls.push(`insert:${userId}:${auctionLotId ?? 'null'}`);
      inserted = structuredClone(item);
    },
  };
  const repo: OverflowAddRepository = {
    async transaction(callback) {
      calls.push('begin');
      try { const result = await callback(tx); calls.push('commit'); return result; }
      catch (error) { calls.push('rollback'); throw error; }
    },
  };
  return { repo, calls, get updated() { return updated; }, get inserted() { return inserted; } };
}

test('добавление блокирует пользователя до складского стека', async () => {
  const state = repository();
  await addOverflowItem(state.repo, { userId: 11, item: { id: 'ore', type: 'material', count: 2 }, auctionLotId: 7 });
  assert.deepEqual(state.calls, ['begin', 'lock-user:11', 'lock-stack:11:ore:material', 'insert:11:7', 'commit']);
  assert.equal(state.inserted?.count, 2);
});

test('добавление стакает ресурс в заблокированной строке', async () => {
  const state = repository({ id: 'ore', type: 'material', count: 3 });
  await addOverflowItem(state.repo, { userId: 11, item: { id: 'ore', type: 'material', count: 2 } });
  assert.equal(state.updated?.count, 5);
  assert.equal(state.inserted, null);
});

test('экипировка всегда создаёт отдельную складскую запись', async () => {
  const state = repository();
  await addOverflowItem(state.repo, { userId: 11, item: { id: 'helm', slot: 'helmet', count: 1 } });
  assert.deepEqual(state.calls, ['begin', 'lock-user:11', 'insert:11:null', 'commit']);
});

test('повреждённое количество ресурса отклоняется до записи', async () => {
  const state = repository();
  await assert.rejects(
    addOverflowItem(state.repo, { userId: 11, item: { id: 'ore', type: 'material', count: -1 } }),
    /Некорректное количество предмета/,
  );
  assert.equal(state.inserted, null);
  assert.equal(state.calls[state.calls.length - 1], 'rollback');
});
