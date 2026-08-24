/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeCraftWithClient } from './craftExecute';

function client(successChance = 100, treasuryFails = false) {
  const writes: string[] = [];
  const query = async (sql: string, params?: unknown[]) => {
    if (sql.includes('castle_treasury') && sql.includes('SELECT')) return { rows: [{ amount: 1000 }], rowCount: 1 };
    if (sql.includes('SELECT * FROM users')) return { rows: [{ id: 7, inventory: JSON.stringify([{ type: 'craft_item', id: 11, count: 2 }]), money: 1000, inventoryslots: 10, faction: null, faction_craft_count: 0, guildid: 3 }], rowCount: 1 };
    if (sql.includes('SELECT * FROM craft_recipes')) return { rows: [{ id: 5, result_type: 'item', result_id: 22, money_cost: 100, success_chance: successChance }], rowCount: 1 };
    if (sql.includes('FROM craft_recipe_ingredients')) return { rows: [{ id: 11, quantity: 1 }], rowCount: 1 };
    if (sql.includes('FROM items i')) return { rows: [{ id: 22, name: 'Меч', slot: 'weapon', rarity_id: 2, rarity_display: 'Редкий', rarity_color: '#00f', bonuses: '{}', extra: '{}', image: null }], rowCount: 1 };
    if (treasuryFails && sql.includes('UPDATE castle_treasury')) throw new Error('treasury failed');
    if (sql.includes('UPDATE users')) writes.push(sql.includes('tutorial_step') ? 'tutorial' : 'user');
    if (sql.includes('UPDATE castle_treasury')) writes.push('treasury');
    if (sql.includes('INSERT INTO treasury_log')) writes.push('log');
    return { rows: [], rowCount: 1 };
  };
  return { client: { query } as any, writes };
}

test('legacy execute success preserves item shape and commits tutorial plus treasury', async () => {
  const fake = client();
  const result = await executeCraftWithClient(fake.client, { userId: 7, recipeId: 5, random: () => 0, now: () => 123 });
  assert.equal(result.status, 200);
  assert.equal(result.success, true);
  assert.deepEqual(Object.keys((result.body as any).item).sort(), ['bonuses','extra','id','image','name','rarity_color','rarity_display','rarity_id','slot','upgradeLevel'].sort());
  assert.equal((result.body as any).item.id, 123);
  assert.deepEqual(fake.writes, ['user', 'tutorial', 'treasury', 'log']);
});

test('legacy execute failure preserves response and does not advance tutorial', async () => {
  const fake = client(0);
  const result = await executeCraftWithClient(fake.client, { userId: 7, recipeId: 5, random: () => 0.5, now: () => 123 });
  assert.deepEqual(result.body, { success: false, inventory: [{ type: 'craft_item', id: 11, count: 1 }], moneyAfter: 900, message: 'Неудача, предмет разрушен' });
  assert.deepEqual(fake.writes, ['user', 'treasury', 'log']);
});

test('legacy execute propagates treasury failure so outer transaction can roll back', async () => {
  const fake = client(100, true);
  await assert.rejects(() => executeCraftWithClient(fake.client, { userId: 7, recipeId: 5, random: () => 0, now: () => 123 }), /treasury failed/);
});

test('legacy execute preserves missing user, recipe and result template statuses', async () => {
  for (const scenario of [
    { missing: 'user', status: 404, error: 'User not found' },
    { missing: 'recipe', status: 400, error: 'Рецепт не найден' },
    { missing: 'template', status: 500, error: 'Результирующий предмет не найден' },
  ]) {
    const base = client();
    const query = base.client.query.bind(base.client);
    base.client.query = async (sql: string, params?: unknown[]) => {
      if (scenario.missing === 'user' && sql.includes('SELECT * FROM users')) return { rows: [], rowCount: 0 };
      if (scenario.missing === 'recipe' && sql.includes('SELECT * FROM craft_recipes')) return { rows: [], rowCount: 0 };
      if (scenario.missing === 'template' && sql.includes('FROM items i')) return { rows: [], rowCount: 0 };
      return query(sql, params);
    };
    const result = await executeCraftWithClient(base.client, { userId: 7, recipeId: 5, random: () => 0, now: () => 123 });
    assert.equal(result.status, scenario.status);
    assert.deepEqual(result.body, { error: scenario.error });
    assert.deepEqual(base.writes, []);
  }
});

test('legacy execute keeps zero-cost recipes free of treasury writes', async () => {
  const fake = client();
  const query = fake.client.query.bind(fake.client);
  fake.client.query = async (sql: string, params?: unknown[]) => {
    if (sql.includes('SELECT * FROM craft_recipes')) {
      return { rows: [{ id: 5, result_type: 'item', result_id: 22, money_cost: 0, success_chance: 100 }], rowCount: 1 };
    }
    return query(sql, params);
  };
  const result = await executeCraftWithClient(fake.client, { userId: 7, recipeId: 5, random: () => 0, now: () => 123 });
  assert.equal(result.status, 200);
  assert.deepEqual(fake.writes, ['user', 'tutorial']);
});
