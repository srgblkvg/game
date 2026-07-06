import { CharStats, GameItem, PRIMARY_STATS, sumStats, currentStats } from './stats';
import { F, sv } from './stats';

export interface BattleStep {
  type: 'attack' | 'dodge' | 'counter' | 'block' | 'fullBlock' | 'crit' | 'stun' | 'damage' | 'info' | 'end' | 'money';
  actor?: 'attacker' | 'defender';
  target?: 'attacker' | 'defender';
  message: string;
  damage?: number;
  amount?: number;
  hp1?: number;
  hp2?: number;
  maxHp1?: number;
  maxHp2?: number;
  stats1?: any;
  stats2?: any;
}

interface BattleResult {
  winnerId: number;
  log: string[];
  steps: BattleStep[];
  attackerHpAfter: number;
  defenderHpAfter: number;
  expGained: number;
  moneyGained: number;
  moneyStolen: number;
}

// ── Формулы (используют конфиг F из stats.ts) ──

export function dodgeChance(defStats: CharStats, atkStats: CharStats): number {
  const defW = sv(defStats, F.dodgeDef);
  const atkW = sv(atkStats, F.dodgePen);
  const extraDodge = (defStats.extra.dodge || 0);
  return Math.max(0,
    (defW / (defW + 500)) *
    (1 - atkW / (atkW + 100)) / 1.5 +
    Math.min(0.5, extraDodge / (extraDodge + 300))
  );
}

export function critChance(stats: CharStats): number {
  const extraCrit = (stats.extra.crit || 0);
  return Math.min(0.8, sv(stats, F.crit) / (sv(stats, F.crit) + 500) / 1.5 + extraCrit / (extraCrit + 300));
}

export function critMult(stats: CharStats): number {
  return 1.5 + 0.5 * (sv(stats, F.crit) / (sv(stats, F.crit) + 50));
}

export function blockChance(defStats: CharStats): number {
  const extraBlock = (defStats.extra.fullBlock || 0);
  return Math.min(0.75, sv(defStats, F.block) / (sv(defStats, F.block) + 500) / 1.5 + extraBlock / (extraBlock + 300));
}

export function blockReduction(defStats: CharStats, atkStats: CharStats): number {
  const ratio = sv(defStats, F.block) / Math.max(1, sv(atkStats, F.damage));
  return Math.min(0.75, 0.5 * ratio);
}

export function counterChance(defStats: CharStats, atkStats: CharStats, extraBonus: number): number {
  const dSum = sv(defStats, F.counterDef) + sv(atkStats, F.counterTgt);
  return Math.min(0.5, (dSum > 0 ? sv(defStats, F.counterDef) / dSum * 0.5 / 1.5 : 0) + extraBonus / (extraBonus + 300));
}

export function stunChance(atkStats: CharStats, defStats: CharStats): number {
  const sum = sv(atkStats, F.stunAtk) + sv(defStats, F.stunDef);
  return sum > 0 ? sv(atkStats, F.stunAtk) / sum * 0.3 : 0;
}

// Смешанное распределение урона: 1% мин(level), 98% ~центр(70%), 1% макс(S)
export function rollDamage(stats: CharStats, level: number): number {
  const S = sumStats(stats);
  const roll = Math.random();
  let factor: number;
  if (roll < 0.01) {
    factor = 0;
  } else if (roll > 0.99) {
    factor = 1;
  } else {
    const u = (Math.random() + Math.random()) / 2;
    if (u < 0.5) {
      factor = (u / 0.5) * 0.7;
    } else {
      factor = 0.7 + ((u - 0.5) / 0.5) * 0.3;
    }
  }
  return Math.round(level + factor * (S - level));
}

// ── Один ход боя (symmetrical — работает для обеих сторон) ──

interface TurnContext {
  actorName: string;
  targetName: string;
  actorStats: CharStats;
  targetStats: CharStats;
  actorLevel: number;
  hpActor: number;
  hpTarget: number;
  maxHpActor: number;
  maxHpTarget: number;
  actor: 'attacker' | 'defender';
  target: 'attacker' | 'defender';
}

function runTurn(ctx: TurnContext, addStep: (s: BattleStep) => void): { hpActor: number; hpTarget: number; stunnedTarget: boolean } {
  let hpActor = ctx.hpActor;
  let hpTarget = ctx.hpTarget;
  let stunnedTarget = false;

  addStep({ type: 'attack', actor: ctx.actor, message: `${ctx.actorName} атакует!` });

  if (Math.random() < dodgeChance(ctx.targetStats, ctx.actorStats)) {
    addStep({ type: 'dodge', actor: ctx.target, message: `${ctx.targetName} уклоняется!` });
    if (Math.random() < counterChance(ctx.targetStats, ctx.actorStats, ctx.targetStats.extra.counter || 0)) {
      addStep({ type: 'counter', actor: ctx.target, message: `${ctx.targetName} контратакует!` });
      let cdmg = ctx.targetStats.s;
      if (Math.random() < critChance(ctx.targetStats)) {
        cdmg *= critMult(ctx.targetStats);
        addStep({ type: 'crit', actor: ctx.target, message: `Крит!` });
      }
      cdmg = Math.max(0, Math.round(cdmg));
      hpActor = Math.max(0, hpActor - cdmg);
      addStep({ type: 'damage', actor: ctx.target, target: ctx.actor, damage: cdmg, message: `Урон: ${cdmg}`,
        hp1: ctx.actor === 'attacker' ? hpActor : hpTarget, hp2: ctx.actor === 'attacker' ? hpTarget : hpActor,
        maxHp1: ctx.maxHpActor, maxHp2: ctx.maxHpTarget });
    }
    return { hpActor, hpTarget, stunnedTarget };
  }

  // Попадание
  addStep({ type: 'info', message: `Попадание!` });
  let dmg = rollDamage(ctx.actorStats, ctx.actorLevel);
  if (Math.random() < critChance(ctx.actorStats)) {
    dmg *= critMult(ctx.actorStats);
    addStep({ type: 'crit', actor: ctx.actor, message: `Крит!` });
  }
  const fb = (ctx.targetStats.extra.fullBlock || 0);
  const fullBlockChance = fb / (fb + 300);
  if (Math.random() < fullBlockChance) {
    dmg = 0;
    addStep({ type: 'fullBlock', actor: ctx.target, message: `ПОЛНЫЙ БЛОК!` });
  } else if (Math.random() < blockChance(ctx.targetStats)) {
    const blocked = dmg * blockReduction(ctx.targetStats, ctx.actorStats);
    dmg -= blocked;
    addStep({ type: 'block', actor: ctx.target, message: `Блок (-${Math.round(blocked)})` });
  }
  dmg = Math.max(0, Math.round(dmg));
  hpTarget = Math.max(0, hpTarget - dmg);
  addStep({ type: 'damage', actor: ctx.actor, target: ctx.target, damage: dmg, message: `Урон: ${dmg}`,
    hp1: ctx.actor === 'attacker' ? hpActor : hpTarget, hp2: ctx.actor === 'attacker' ? hpTarget : hpActor,
    maxHp1: ctx.maxHpActor, maxHp2: ctx.maxHpTarget });
  if (dmg > 0 && Math.random() < stunChance(ctx.actorStats, ctx.targetStats)) {
    stunnedTarget = true;
    addStep({ type: 'stun', actor: ctx.target, message: `${ctx.targetName} оглушён!` });
  }

  return { hpActor, hpTarget, stunnedTarget };
}

// ── Главная функция боя ──

export function runBattle(
  attacker: { id: number; name: string; base: any; equipment: Record<string, GameItem>; level: number; money: number; currentHp?: number; drinkBonuses?: any; collectionBonus?: number; guildBonus?: number; stats?: CharStats },
  defender: { id: number; name: string; base: any; equipment: Record<string, GameItem>; level: number; money: number; currentHp?: number; drinkBonuses?: any; collectionBonus?: number; guildBonus?: number; stats?: CharStats }
): BattleResult {
  const statsA = attacker.stats || currentStats(attacker.base, attacker.equipment, attacker.drinkBonuses, attacker.collectionBonus, attacker.guildBonus);
  const statsD = defender.stats || currentStats(defender.base, defender.equipment, defender.drinkBonuses, defender.collectionBonus, defender.guildBonus);
  let hpA = (attacker.currentHp != null) ? attacker.currentHp : statsA.hp;
  let hpD = (defender.currentHp != null) ? defender.currentHp : statsD.hp;
  let stunnedA = false;
  let stunnedD = false;
  const log: string[] = [];
  const steps: BattleStep[] = [];

  const addStep = (step: BattleStep) => {
    steps.push(step);
    log.push(step.message);
  };

  const maxHpA = statsA.hp;
  const maxHpD = statsD.hp;
  addStep({ type: 'info', message: `⚔ ${attacker.name} vs ${defender.name}`, hp1: hpA, hp2: hpD, maxHp1: maxHpA, maxHp2: maxHpD,
    stats1: { name: attacker.name, level: attacker.level, S: statsA.s, A: statsA.a, D: statsA.d, M: statsA.m, HP: maxHpA,
      drinks: attacker.drinkBonuses, collection: attacker.collectionBonus, guildBonus: attacker.guildBonus },
    stats2: { name: defender.name, level: defender.level, S: statsD.s, A: statsD.a, D: statsD.d, M: statsD.m, HP: maxHpD,
      drinks: defender.drinkBonuses, collection: defender.collectionBonus, guildBonus: defender.guildBonus }
  });

  // Кто ходит первым
  let turn: 'A' | 'D' = statsA.a >= statsD.a ? 'A' : 'D';
  addStep({ type: 'info', message: `${turn === 'A' ? attacker.name : defender.name} ходит первым` });

  while (hpA > 0 && hpD > 0) {
    if (turn === 'A') {
      if (stunnedA) {
        addStep({ type: 'stun', actor: 'attacker', message: `${attacker.name} оглушён и пропускает ход` });
        stunnedA = false;
        turn = 'D';
        continue;
      }
      const result = runTurn({
        actorName: attacker.name, targetName: defender.name,
        actorStats: statsA, targetStats: statsD,
        actorLevel: attacker.level,
        hpActor: hpA, hpTarget: hpD,
        maxHpActor: maxHpA, maxHpTarget: maxHpD,
        actor: 'attacker', target: 'defender',
      }, addStep);
      hpA = result.hpActor;
      hpD = result.hpTarget;
      stunnedD = result.stunnedTarget;
      turn = 'D';
    } else {
      if (stunnedD) {
        addStep({ type: 'stun', actor: 'defender', message: `${defender.name} оглушён и пропускает ход` });
        stunnedD = false;
        turn = 'A';
        continue;
      }
      const result = runTurn({
        actorName: defender.name, targetName: attacker.name,
        actorStats: statsD, targetStats: statsA,
        actorLevel: defender.level,
        hpActor: hpD, hpTarget: hpA,
        maxHpActor: maxHpD, maxHpTarget: maxHpA,
        actor: 'defender', target: 'attacker',
      }, addStep);
      hpD = result.hpActor;
      hpA = result.hpTarget;
      stunnedA = result.stunnedTarget;
      turn = 'A';
    }
  }

  const winnerId = hpA <= 0 ? defender.id : attacker.id;
  const winnerName = winnerId === attacker.id ? attacker.name : defender.name;
  addStep({ type: 'end', message: `${winnerName} победил!` });

  let expGained = 0;
  let moneyGained = 0;
  if (winnerId === attacker.id) {
    if (defender.level > attacker.level) expGained = 2;
    else if (defender.level === attacker.level) expGained = 1;
  } else {
    if (attacker.level > defender.level) expGained = 2;
    else if (attacker.level === defender.level) expGained = 1;
  }

  // --- ограбление монет ---
  let moneyStolen = 0;
  const loserId = winnerId === attacker.id ? defender.id : attacker.id;
  const loserMoney = loserId === defender.id ? defender.money || 0 : attacker.money || 0;
  if (loserMoney > 0) {
    const percent = 0.1 + Math.random() * 0.4;
    moneyStolen = Math.max(1, Math.floor(loserMoney * percent));
  }
  if (moneyStolen > 0) {
    const loserName = winnerId === attacker.id ? defender.name : attacker.name;
    addStep({ type: 'money', amount: moneyStolen, message: `${winnerName} забирает ${moneyStolen} монет у ${loserName}!` });
  }

  return {
    winnerId,
    log,
    steps,
    attackerHpAfter: Math.max(0, hpA),
    defenderHpAfter: Math.max(0, hpD),
    expGained,
    moneyGained,
    moneyStolen,
  };
}
