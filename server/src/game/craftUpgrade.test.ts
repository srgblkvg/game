/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeCraftUpgradeWithClient } from './craftUpgrade';

function fakeClient(rows: Record<string, any>[], calls: any[] = []) {
  return {
    async query(sql: string, params: any[] = []) {
      calls.push({ sql, params });
      if (sql.includes('FROM users')) return { rows: [rows[0]] };
      if (sql.includes('FROM upgrade_chances')) return { rows: [rows[1]] };
      if (sql.includes('FROM craft_items')) return { rows: [rows[2]] };
      if (sql.includes('INSERT INTO chat_messages')) return { rows: [{ id: 321 }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  } as any;
}

const user = (overrides: any = {}) => ({
  id: 7, username: 'Hero', money: 10000, elo: 1000, faction: 'guard', faction_craft_count: 0,
  guildid: 19, inventory: JSON.stringify([
    { id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 6 },
    { type: 'craft_item', id: 22, itemType: 'upgrade', rarity_id: 1, count: 2 },
  ]), ...overrides,
});

test('successful +7 upgrade uses one client, locks treasury first, writes chat, and returns announcement', async () => {
  const calls: any[] = [];
  const result = await executeCraftUpgradeWithClient(fakeClient([user(), { chance: 100, money_cost: 400 }], calls), {
    userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0,
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    inventory: [{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 7 }, { type: 'craft_item', id: 22, itemType: 'upgrade', rarity_id: 1, count: 1 }],
    moneyAfter: 9900, eloAdded: 5, message: 'Предмет улучшен до +7 (+5 рейтинга)',
  });
  assert.equal(result.guildId, 19);
  assert.equal(result.announcements?.[0]?.content, '⚒️ Hero улучшил Меч до +7!');
  assert.equal(result.announcements?.[0]?.id, 321);
  assert.match(calls[0].sql, /castle_treasury[\s\S]*FOR UPDATE/);
  assert.match(calls[1].sql, /FROM users[\s\S]*FOR UPDATE/);
  const chatInsert = calls.find(c => c.sql.includes('INSERT INTO chat_messages'));
  assert.match(chatInsert.sql, /RETURNING id/);
  assert.doesNotMatch(chatInsert.sql, /chat_messages\s*\(id/i);
  assert.ok(calls.some(c => c.sql.includes('treasury_log')));
});

test('failed attempt to +7 destroys item, replaces same-rarity material, and records failure', async () => {
  const calls: any[] = [];
  const result = await executeCraftUpgradeWithClient(fakeClient([
    user({ inventory: JSON.stringify([{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 6 }, { type: 'craft_item', id: 22, itemType: 'upgrade', rarity_id: 1, count: 1 }]) }),
    { chance: 0, money_cost: 400 },
    { id: 31, name: 'Осколок', rarity_id: 3, type: 'craft', image: 'x', rarity_display: 'Редкий', rarity_color: 'blue' },
  ], calls), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0.99 });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Неудача! Предмет разрушен.');
  assert.equal(result.body.success, false);
  assert.deepEqual(result.body.inventory, [{ type: 'craft_item', id: 31, name: 'Осколок', rarity_id: 3, rarity_display: 'Редкий', rarity_color: 'blue', count: 1, itemType: 'craft', image: 'x' }]);
  assert.equal(result.announcements?.[0]?.content, '💥 Hero сломал Меч (+6) при улучшении!');
  assert.equal(result.announcements?.[0]?.id, 321);
  const chatInsert = calls.find(c => c.sql.includes('INSERT INTO chat_messages'));
  assert.match(chatInsert.sql, /RETURNING id/);
  assert.doesNotMatch(chatInsert.sql, /chat_messages\s*\(id/i);
  assert.ok(calls.some(c => c.sql.includes('craftbroken')));
  assert.ok(calls.some(c => c.params.includes('craft_upgrade_fail')));
});

test('failed attempt below +7 keeps item and returns legacy failure response', async () => {
  const result = await executeCraftUpgradeWithClient(fakeClient([user({ inventory: JSON.stringify([{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 0 }, { type: 'craft_item', id: 22, itemType: 'upgrade', rarity_id: 1, count: 1 }]) }), { chance: 0, money_cost: 400 }]), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0.99 });
  assert.deepEqual(result.body, {
    success: false,
    inventory: [{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 0 }],
    moneyAfter: 9900,
    message: 'Неудача! Предмет не улучшен.',
  });
});

test('ordinary success preserves payload without eloAdded', async () => {
  const result = await executeCraftUpgradeWithClient(fakeClient([
    user({ inventory: JSON.stringify([{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 0 }, { type: 'craft_item', id: 22, itemType: 'upgrade', rarity_id: 1, count: 1 }]) }),
    { chance: 100, money_cost: 400 },
  ]), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0 });
  assert.deepEqual(result.body, {
    success: true,
    inventory: [{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 1 }],
    moneyAfter: 9900,
    message: 'Предмет улучшен до +1',
  });
});

 test('faction crafter experience follows legacy predicate and +10 rating is preserved', async () => {
  const calls: any[] = [];
  const result = await executeCraftUpgradeWithClient(fakeClient([user({ faction: 'crafter', faction_craft_count: 0, inventory: JSON.stringify([{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 9 }, { type: 'craft_item', id: 22, itemType: 'upgrade', count: 1 }]) }), { chance: 60, money_cost: 400 }], calls), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0 });
  assert.equal(result.body.eloAdded, 50);
  const update = calls.find(c => c.sql.includes('craftupgraded'));
  assert.match(update.sql, /faction_craft_count = faction_craft_count \+ 1/);
});

 test('insufficient money fails before consuming inventory', async () => {
  const result = await executeCraftUpgradeWithClient(fakeClient([user({ money: 1 }), { chance: 100, money_cost: 400 }]), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0 });
  assert.deepEqual(result.body, { error: 'Недостаточно денег. Требуется 100' });
  assert.equal(result.status, 400);
});

 test('existing replacement material is incremented', async () => {
  const result = await executeCraftUpgradeWithClient(fakeClient([user({ inventory: JSON.stringify([{ id: 11, name: 'Меч', rarity_id: 3, upgradeLevel: 6 }, { type: 'craft_item', id: 22, itemType: 'upgrade', rarity_id: 1, count: 1 }, { type: 'craft_item', id: 31, itemType: 'craft', rarity_id: 3, count: 4 }]) }), { chance: 0, money_cost: 400 }, { id: 31, name: 'Осколок', rarity_id: 3, type: 'craft' }]), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }], random: () => 0.99 });
  assert.equal((result.body.inventory as any[]).find(i => i.id === 31).count, 5);
});

 test('missing locked item is reported with legacy message', async () => {
  const result = await executeCraftUpgradeWithClient(fakeClient([user({ inventory: '[]' }), { chance: 100, money_cost: 400 }]), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }] });
  assert.deepEqual(result.body, { error: 'Предмет не найден в инвентаре' });
  assert.equal(result.status, 400);
});

test('locked item is rejected', async () => {
  const result = await executeCraftUpgradeWithClient(fakeClient([user({ inventory: JSON.stringify([{ id: 11, locked: true, upgradeLevel: 0 }, { type: 'craft_item', id: 22, itemType: 'upgrade', count: 1 }]) }), { chance: 100, money_cost: 400 }]), { userId: 7, slots: [{ id: 11 }, { type: 'craft_item', id: 22, itemType: 'upgrade' }] });
  assert.equal(result.body.error, 'Предмет заблокирован. Разблокируйте в инвентаре.');
});