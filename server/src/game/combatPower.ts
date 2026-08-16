import type { CharStats } from './stats';
import type { BattleAntiStats } from './battle';
import { dodgeChance, critChance, critMult, blockChance, blockReduction, counterChance, stunChance } from './battle';

// Фиксированный сезонный эталон. БМ не зависит от того, кто сейчас онлайн.
const POWER_REFERENCE: CharStats = {
  s: 563, a: 421, d: 252, m: 256,
  hp: 2584,
  bonuses: { s: 0, a: 0, d: 0, m: 0 },
  drinks: { s: 0, a: 0, d: 0, m: 0 },
  collection: 0,
  extra: { crit: 40, dodge: 40, counter: 40, fullBlock: 40 },
  vampirism: 5,
};

const ZERO_ANTI: BattleAntiStats = {
  antiDodge: 0, antiCrit: 0, antiBlock: 0, antiCounter: 0, antiVampiric: 0,
};

function reduced(chance: number, anti: number): number {
  return Math.max(0, chance - anti / 100);
}

/**
 * Аналитическая боевая мощь по актуальному battle.ts.
 * Не заменяет runBattle: это стабильный показатель для турниров и рейтинга.
 */
export function calculateCombatPower(stats: CharStats, antiStats: BattleAntiStats = ZERO_ANTI, level = 1): number {
  const opponent = POWER_REFERENCE;
  const extra = stats.extra || {};
  const selfCrit = critChance(stats);
  const selfDodge = dodgeChance(stats, opponent);
  const selfBlock = blockChance(stats);
  const selfFullBlock = (extra.fullBlock || 0) / ((extra.fullBlock || 0) + 300);
  const opponentDodge = reduced(dodgeChance(opponent, stats), antiStats.antiDodge);
  const opponentBlock = reduced(blockChance(opponent), antiStats.antiBlock);
  const opponentFullBlock = reduced((opponent.extra.fullBlock || 0) / ((opponent.extra.fullBlock || 0) + 300), antiStats.antiBlock);

  const normalDamage = level + 0.7 * Math.max(0, stats.s - level);
  const criticalDamage = (level + 0.75 * Math.max(0, stats.s - level)) * critMult(stats);
  const opponentBlockReduction = blockReduction(opponent, stats) * (1 - Math.min(1, (stats.blockPen || 0) / 100));
  const expectedDamage = (1 - opponentDodge)
    * ((1 - selfCrit) * normalDamage + selfCrit * criticalDamage)
    * (1 - opponentFullBlock)
    * (1 - opponentBlock * opponentBlockReduction);

  const opponentCrit = reduced(critChance(opponent), antiStats.antiCrit);
  const opponentCounter = reduced(counterChance(opponent, stats, opponent.extra.counter || 0), antiStats.antiCounter);
  const opponentVampirism = Math.max(0, (opponent.vampirism || 0) - antiStats.antiVampiric) / 100;
  const opponentLevel = 8;
  const opponentDamage = (opponentLevel + 0.7 * Math.max(0, opponent.s - opponentLevel))
    * ((1 - opponentCrit) + opponentCrit * critMult(opponent));
  const incoming = (1 - selfDodge) * opponentDamage
    * (1 - selfFullBlock)
    * (1 - selfBlock * blockReduction(stats, opponent))
    * (1 + 0.5 * opponentCounter);
  const effectiveHp = Math.max(1, stats.hp) + expectedDamage * ((stats.vampirism || 0) / 100) * 8;

  const ownCounter = counterChance(stats, opponent, extra.counter || 0);
  const ownStun = stunChance(stats, opponent);
  const tempo = (stats.alwaysFirst ? 1.08 : 1) * (1 + 0.5 * ownCounter + 0.5 * ownStun);
  const effects = 1
    + ((stats.poisonOnHit || 0) / 100) * 3
    + ((stats.counterOnHit || 0) / 100) * 0.5
    + ((stats.rageDmg || 0) / 100) * 0.5
    + (stats.execute ? 0.08 : 0);

  const opponentSustain = 1 + opponentVampirism * 4;
  return Math.max(1, Math.round((expectedDamage / Math.max(1, incoming)) * Math.sqrt(effectiveHp) * tempo * effects / opponentSustain * 100));
}

export { POWER_REFERENCE };
