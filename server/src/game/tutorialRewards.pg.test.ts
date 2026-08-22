/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { completeTutorial, grantTutorialCraftReward, grantTutorialPveReward, skipTutorial } from './tutorialRewards';
import { createPgTutorialRewardRepository } from './tutorialRewardsRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;
const parse = (value: any) => typeof value === 'string' ? JSON.parse(value) : value;

async function createUser(label: string, step: number, money: number, inventory: any[]): Promise<number> {
  return Number((await pool.query(
    `INSERT INTO users (username, passwordhash, level, gender, tutorial_step, money, inventory)
     VALUES ($1, 'test', 1, 'male', $2, $3, $4) RETURNING id`,
    [`tutorial_reward_${label}_${Date.now()}_${Math.random()}`, step, money, JSON.stringify(inventory)],
  )).rows[0].id);
}

async function cleanup(userId: number | null) {
  if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

pgTest('два параллельных PvE reward начисляют добычу один раз', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('pve', 0, 100, []);
    const call = () => grantTutorialPveReward(createPgTutorialRewardRepository(), {
      userId: userId!,
      sword: { id: 'tutorial-sword', name: 'Стон могильщика', slot: 'weapon1' },
      dust: { id: 1, type: 'craft_item', count: 1 },
      now: 1234,
    });
    const settled = await Promise.allSettled([call(), call()]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    const row = (await pool.query(
      'SELECT inventory, money, tutorial_step FROM users WHERE id=$1', [userId],
    )).rows[0];
    const inventory = parse(row.inventory);
    assert.equal(inventory.find((item: any) => item.id === 1)?.count, 1);
    assert.equal(inventory.filter((item: any) => item.id === 'tutorial-sword').length, 1);
    assert.equal(Number(row.money), 105);
    assert.equal(Number(row.tutorial_step), 1);
  } finally { await cleanup(userId); }
});

pgTest('два параллельных tutorial craft расходуют пыль и создают щит один раз', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('craft', 2, 105, [{ id: 1, type: 'craft_item', count: 2 }]);
    const call = () => grantTutorialCraftReward(createPgTutorialRewardRepository(), {
      userId: userId!, shield: { id: 'tutorial-shield', slot: 'shield' }, dustId: 1,
    });
    const settled = await Promise.allSettled([call(), call()]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    const row = (await pool.query('SELECT inventory, tutorial_step FROM users WHERE id=$1', [userId])).rows[0];
    const inventory = parse(row.inventory);
    assert.equal(inventory.find((item: any) => item.id === 1)?.count, 1);
    assert.equal(inventory.filter((item: any) => item.id === 'tutorial-shield').length, 1);
    assert.equal(Number(row.tutorial_step), 3);
  } finally { await cleanup(userId); }
});

pgTest('два параллельных завершения начисляют 1000 серебра один раз', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('complete', 5, 105, []);
    const call = () => completeTutorial(createPgTutorialRewardRepository(), { userId: userId!, reward: 1000 });
    const results = await Promise.all([call(), call()]);
    assert.deepEqual(results.map(result => result.reward).sort((a, b) => a - b), [0, 1000]);
    const row = (await pool.query(
      'SELECT money, tutorial_step, tutorial_completed FROM users WHERE id=$1', [userId],
    )).rows[0];
    assert.equal(Number(row.money), 1105);
    assert.equal(Number(row.tutorial_step), 6);
    assert.equal(Number(row.tutorial_completed), 1);
  } finally { await cleanup(userId); }
});

pgTest('параллельные completion и skip применяют только один terminal transition', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('complete_skip', 3, 105, []);
    const repository = createPgTutorialRewardRepository();
    const results = await Promise.all([
      completeTutorial(repository, { userId, reward: 1000, requiredStep: 3 }),
      skipTutorial(repository, { userId }),
    ]);
    const row = (await pool.query(
      'SELECT money, tutorial_step, tutorial_completed FROM users WHERE id=$1', [userId],
    )).rows[0];
    assert.ok([105, 1105].includes(Number(row.money)));
    assert.equal(results.reduce((sum, result) => sum + result.reward, 0), Number(row.money) - 105);
    assert.equal(Number(row.tutorial_step), 6);
    assert.equal(Number(row.tutorial_completed), 1);
  } finally { await cleanup(userId); }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
