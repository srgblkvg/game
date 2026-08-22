/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { takeOverflowItem, type OverflowTakeRepository, type OverflowTakeTransaction } from './overflowTake';

function repository(options: {
  item?: Record<string, unknown> | null;
  inventory?: Record<string, unknown>[];
  inventorySlots?: number;
  failSave?: boolean;
  failDelete?: boolean;
} = {}) {
  const calls: string[] = [];
  let deleted = false;
  let saved: Record<string, unknown>[] | null = null;
  const tx: OverflowTakeTransaction = {
    async lockOverflowItem(id, userId) {
      calls.push(`lock-item:${id}:${userId}`);
      return options.item === null ? null : {
        id,
        userId,
        item: options.item ?? { id: 'ore', type: 'material', count: 2 },
      };
    },
    async lockUser(userId) {
      calls.push(`lock-user:${userId}`);
      return { id: userId, inventory: options.inventory ?? [], inventorySlots: options.inventorySlots ?? 10 };
    },
    async saveInventory(userId, inventory) {
      calls.push(`save:${userId}`);
      if (options.failSave) throw new Error('save failed');
      saved = structuredClone(inventory);
    },
    async deleteOverflowItem(id, userId) {
      calls.push(`delete:${id}:${userId}`);
      if (options.failDelete) throw new Error('delete failed');
      deleted = true;
    },
  };
  const repo: OverflowTakeRepository = {
    async transaction(callback) {
      calls.push('begin');
      try {
        const result = await callback(tx);
        calls.push('commit');
        return result;
      } catch (error) {
        calls.push('rollback');
        throw error;
      }
    },
  };
  return { repo, calls, get deleted() { return deleted; }, get saved() { return saved; } };
}

test('забирает предмет после блокировки пользователя и складской записи', async () => {
  const state = repository({ item: { id: 'helm', slot: 'helmet', name: 'Шлем' } });
  const result = await takeOverflowItem(state.repo, { overflowId: 7, userId: 11 });

  assert.deepEqual(state.calls, ['begin', 'lock-user:11', 'lock-item:7:11', 'save:11', 'delete:7:11', 'commit']);
  assert.equal(state.deleted, true);
  assert.equal(state.saved?.length, 1);
  assert.equal(result.stacked, false);
});

test('стакает ресурс с существующим предметом', async () => {
  const state = repository({
    item: { id: 'ore', type: 'material', count: 2 },
    inventory: [{ id: 'ore', type: 'material', count: 3 }],
  });
  const result = await takeOverflowItem(state.repo, { overflowId: 8, userId: 11 });

  assert.equal(state.saved?.[0]?.count, 5);
  assert.equal(result.stacked, true);
});

test('не принимает повреждённое количество складского ресурса', async () => {
  const state = repository({
    item: { id: 'ore', type: 'material', count: -2 },
    inventory: [{ id: 'ore', type: 'material', count: 3 }],
  });

  await assert.rejects(
    takeOverflowItem(state.repo, { overflowId: 13, userId: 11 }),
    /Некорректное количество предмета/,
  );
  assert.equal(state.deleted, false);
  assert.equal(state.saved, null);
});

test('не удаляет предмет со склада при заполненном инвентаре', async () => {
  const state = repository({
    item: { id: 'helm', slot: 'helmet' },
    inventorySlots: 1,
    inventory: [{ id: 'boots', slot: 'boots' }],
  });

  await assert.rejects(
    takeOverflowItem(state.repo, { overflowId: 9, userId: 11 }),
    /Инвентарь заполнен/,
  );
  assert.equal(state.deleted, false);
  assert.equal(state.saved, null);
  assert.equal(state.calls[state.calls.length - 1], 'rollback');
});

test('повторное получение отсутствующей записи безопасно отклоняется', async () => {
  const state = repository({ item: null });
  await assert.rejects(
    takeOverflowItem(state.repo, { overflowId: 10, userId: 11 }),
    /Предмет не найден/,
  );
  assert.deepEqual(state.calls, ['begin', 'lock-user:11', 'lock-item:10:11', 'rollback']);
});

test('ошибка сохранения откатывает операцию до удаления склада', async () => {
  const state = repository({ failSave: true });
  await assert.rejects(
    takeOverflowItem(state.repo, { overflowId: 12, userId: 11 }),
    /save failed/,
  );
  assert.equal(state.deleted, false);
  assert.equal(state.calls[state.calls.length - 1], 'rollback');
});

test('ошибка удаления после сохранения inventory откатывает транзакцию', async () => {
  const state = repository({ failDelete: true });
  await assert.rejects(
    takeOverflowItem(state.repo, { overflowId: 14, userId: 11 }),
    /delete failed/,
  );
  assert.deepEqual(state.calls.slice(-3), ['save:11', 'delete:14:11', 'rollback']);
  assert.equal(state.deleted, false);
});
