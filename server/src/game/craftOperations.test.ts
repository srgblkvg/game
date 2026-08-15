/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyReforge,
  curseMeetsTarget,
  getTargetCurseChance,
  shouldApplyCurseCandidate,
  getReforgeCost,
  planBatchForge,
  type UpgradeRule,
} from './craftOperations';

test('перековка переносит базовую характеристику и объединяет её с существующей', () => {
  const item = {
    id: 1,
    rarity_id: 6,
    upgradeLevel: 5,
    bonuses: { s: 26, a: 0, d: 22, m: 0 },
    extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0, set: 'Страж' },
    curseStat: 's',
    curseValue: 40,
  };

  const result = applyReforge(item, 'd', 's');

  assert.equal(result.bonuses!.s, 48);
  assert.equal(result.bonuses!.d, 0);
  assert.equal(result.extra!.set, 'Страж');
  assert.equal(result.curseStat, 's');
  assert.equal(result.curseValue, 40);
  assert.equal(result.reforgeCount, 1);
});

test('перековка extra сохраняет сетовые поля', () => {
  const item = {
    id: 2,
    rarity_id: 6,
    bonuses: { s: 0, a: 0, d: 0, m: 0 },
    extra: { crit: 24, dodge: 0, counter: 0, fullBlock: 18, set: 'Жнец', setBonus2: '+5% вампиризм' },
  };

  const result = applyReforge(item, 'fullBlock', 'crit');

  assert.equal(result.extra!.crit, 42);
  assert.equal(result.extra!.fullBlock, 0);
  assert.equal(result.extra!.set, 'Жнец');
  assert.equal(result.extra!.setBonus2, '+5% вампиризм');
});

test('перековка поддерживает характеристики, сохранённые JSON-строкой', () => {
  const item = {
    rarity_id: 6,
    bonuses: JSON.stringify({ s: 12, a: 0, d: 8, m: 0 }) as any,
    extra: JSON.stringify({ crit: 0, dodge: 0, counter: 0, fullBlock: 0 }) as any,
  };
  const result = applyReforge(item, 'd', 'a');
  assert.equal(result.bonuses!.d, 0);
  assert.equal(result.bonuses!.a, 8);
});

test('нельзя перековывать бонус артефакта, менять группу или пустую характеристику', () => {
  const artifact = { rarity_id: 7, bonuses: { s: 10 }, extra: { crit: 20, effect: 'luck' } };
  assert.throws(() => applyReforge(artifact, 'crit', 'dodge'), /артефакт/i);
  assert.equal(applyReforge(artifact, 's', 'a').bonuses!.a, 10);
  assert.throws(() => applyReforge({ rarity_id: 6, bonuses: { s: 10 }, extra: {} }, 's', 'crit'), /групп/i);
  assert.throws(() => applyReforge({ rarity_id: 6, bonuses: { s: 0 }, extra: {} }, 's', 'a'), /положительн/i);
});

test('стоимость перековки зависит от редкости, усиления и числа предыдущих перековок', () => {
  assert.equal(getReforgeCost({ rarity_id: 6, upgradeLevel: 5, reforgeCount: 0 }), 450000);
  assert.equal(getReforgeCost({ rarity_id: 6, upgradeLevel: 5, reforgeCount: 1 }), 675000);
  assert.equal(getReforgeCost({ rarity_id: 6, upgradeLevel: 5, reforgeCount: 3 }), 1350000);
});

test('план массовой ковки считает максимальную цену и количество камней', () => {
  const rules: UpgradeRule[] = [
    { level: 2, rarityId: 6, chance: 90, moneyCost: 1250 },
    { level: 3, rarityId: 6, chance: 70, moneyCost: 2500 },
    { level: 4, rarityId: 6, chance: 50, moneyCost: 4500 },
  ];
  const plan = planBatchForge([
    { item: { id: 'a', rarity_id: 6, upgradeLevel: 1 }, targetLevel: 4 },
    { item: { id: 'b', rarity_id: 6, upgradeLevel: 2 }, targetLevel: 3 },
  ], rules);

  assert.equal(plan.requiredStones, 4);
  assert.equal(plan.totalCost, 10750);
  assert.deepEqual(plan.entries.map(entry => entry.levels), [[2, 3, 4], [3]]);
});

test('план ковки отклоняет дубли и неверный целевой уровень', () => {
  const rules: UpgradeRule[] = [{ level: 2, rarityId: 6, chance: 90, moneyCost: 100 }];
  assert.throws(() => planBatchForge([
    { item: { id: 1, rarity_id: 6, upgradeLevel: 1 }, targetLevel: 2 },
    { item: { id: 1, rarity_id: 6, upgradeLevel: 1 }, targetLevel: 2 },
  ], rules), /повтор/i);

  assert.throws(() => planBatchForge([
    { item: { id: 3, rarity_id: 6, upgradeLevel: 5 }, targetLevel: 5 },
  ], rules), /выше текущего/i);
});

test('целевое проклятие принимает выбранную характеристику и ранг не ниже требуемого', () => {
  assert.equal(curseMeetsTarget({ stat: 's', rank: 3 }, 's', 3), true);
  assert.equal(curseMeetsTarget({ stat: 's', rank: 5 }, 's', 3), true);
  assert.equal(curseMeetsTarget({ stat: 'a', rank: 5 }, 's', 3), false);
  assert.equal(curseMeetsTarget({ stat: 's', rank: 2 }, 's', 3), false);
});

test('вероятность целевого проклятия учитывает характеристику, минимальный ранг и лимит', () => {
  const oneAttempt = getTargetCurseChance('s', 3, 1);
  const tenAttempts = getTargetCurseChance('s', 3, 10);
  assert.equal(oneAttempt, 2);
  assert.ok(tenAttempts > oneAttempt);
  assert.ok(tenAttempts < 100);
  assert.throws(() => getTargetCurseChance('s', 3, 101), /не более 100/i);
});

test('поиск проклятия сначала улучшает характеристику, затем приближает ранг', () => {
  assert.equal(shouldApplyCurseCandidate(null, { stat: 'a', rank: 1 }, 's', 4), true);
  assert.equal(shouldApplyCurseCandidate({ stat: 'a', rank: 5 }, { stat: 's', rank: 1 }, 's', 4), true);
  assert.equal(shouldApplyCurseCandidate({ stat: 's', rank: 1 }, { stat: 'a', rank: 4 }, 's', 4), false);
  assert.equal(shouldApplyCurseCandidate({ stat: 's', rank: 1 }, { stat: 's', rank: 3 }, 's', 4), true);
  assert.equal(shouldApplyCurseCandidate({ stat: 's', rank: 3 }, { stat: 's', rank: 2 }, 's', 4), false);
});

test('цель проклятия позволяет выбрать только характеристику, только ранг или ничего', () => {
  assert.equal(curseMeetsTarget({ stat: 's', rank: 1 }, 's', null), true);
  assert.equal(curseMeetsTarget({ stat: 'a', rank: 4 }, null, 4), true);
  assert.equal(curseMeetsTarget({ stat: 'a', rank: 1 }, null, null), true);
  assert.equal(shouldApplyCurseCandidate({ stat: 'a', rank: 5 }, { stat: 's', rank: 1 }, 's', null), true);
  assert.equal(shouldApplyCurseCandidate({ stat: 'a', rank: 2 }, { stat: 'm', rank: 4 }, null, 5), true);
});
