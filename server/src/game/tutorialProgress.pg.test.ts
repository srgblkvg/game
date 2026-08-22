/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { pool } from '../db/index';
import { advanceTutorialArenaStep, advanceTutorialEquipmentStep } from './tutorialProgress';
import { createPgTutorialProgressRepository } from './tutorialProgressRepository';

const shouldRun = process.env.RUN_PG_TESTS === '1';
const pgTest = shouldRun ? test : test.skip;

async function createUser(label: string, step: number, equipment2: Record<string, any>): Promise<number> {
  return Number((await pool.query(
    `INSERT INTO users (
       username, passwordhash, level, gender, tutorial_step,
       active_equip_slot, equipment, equipment_1, equipment_2, equipment_3
     ) VALUES ($1, 'test', 1, 'male', $2, 2, '{}'::jsonb, '{}'::jsonb, $3::jsonb, '{}'::jsonb)
     RETURNING id`,
    [`tutorial_progress_${label}_${Date.now()}_${Math.random()}`, step, JSON.stringify(equipment2)],
  )).rows[0].id);
}

async function cleanup(userId: number | null) {
  if (userId !== null) await pool.query('DELETE FROM users WHERE id=$1', [userId]);
}

pgTest('два параллельных подтверждения меча переводят шаг 1→2 один раз', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('weapon', 1, { weapon1: { id: 'sword' } });
    const call = () => advanceTutorialEquipmentStep(createPgTutorialProgressRepository(), {
      userId: userId!, expectedStep: 1, nextStep: 2, requiredSlot: 'weapon1',
      missingMessage: 'Сначала наденьте меч',
    });
    const settled = await Promise.allSettled([call(), call()]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    const step = Number((await pool.query('SELECT tutorial_step FROM users WHERE id=$1', [userId])).rows[0].tutorial_step);
    assert.equal(step, 2);
  } finally { await cleanup(userId); }
});

pgTest('два параллельных подтверждения щита переводят шаг 3→4 один раз', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('shield', 3, { shield: { id: 'shield' } });
    const call = () => advanceTutorialEquipmentStep(createPgTutorialProgressRepository(), {
      userId: userId!, expectedStep: 3, nextStep: 4, requiredSlot: 'shield',
      missingMessage: 'Сначала наденьте щит',
    });
    const settled = await Promise.allSettled([call(), call()]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    const step = Number((await pool.query('SELECT tutorial_step FROM users WHERE id=$1', [userId])).rows[0].tutorial_step);
    assert.equal(step, 4);
  } finally { await cleanup(userId); }
});

pgTest('два параллельных arena перехода переводят шаг 4→5 один раз', async () => {
  let userId: number | null = null;
  try {
    userId = await createUser('arena', 4, {});
    const call = () => advanceTutorialArenaStep(createPgTutorialProgressRepository(), {
      userId: userId!, now: 5678,
    });
    const settled = await Promise.allSettled([call(), call()]);
    assert.equal(settled.filter(result => result.status === 'fulfilled').length, 1);
    const row = (await pool.query(
      'SELECT tutorial_step, lastpvptime FROM users WHERE id=$1', [userId],
    )).rows[0];
    assert.equal(Number(row.tutorial_step), 5);
    assert.equal(Number(row.lastpvptime), 5678);
  } finally { await cleanup(userId); }
});

test.after(async () => {
  if (shouldRun) await pool.end();
});
