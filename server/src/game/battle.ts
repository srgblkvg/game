import { CharStats, GameItem, PRIMARY_STATS, currentStats } from './stats';
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
  const extra = defStats.extra || {};
  const extraDodge = (extra.dodge || 0);
  const luckBonus = (defStats.luckBoost || 0) / 100;
  return Math.max(0,
    (defW / (defW + 500)) *
    (1 - atkW / (atkW + 500)) / 1.5 +
    Math.min(0.5, extraDodge / (extraDodge + 300))
  ) + luckBonus;
}

export function critChance(stats: CharStats): number {
  const ex = stats.extra || {};
  const extraCrit = (ex.crit || 0);
  const luckBonus = (stats.luckBoost || 0) / 100;
  return Math.min(0.8, sv(stats, F.crit) / (sv(stats, F.crit) + 500) / 1.5 + extraCrit / (extraCrit + 300)) + luckBonus;
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
  return Math.min(0.75, 0.9 * ratio);
}

export function counterChance(defStats: CharStats, atkStats: CharStats, extraBonus: number): number {
  const dSum = sv(defStats, F.counterDef) + sv(atkStats, F.counterTgt);
  return Math.min(0.5, (dSum > 0 ? sv(defStats, F.counterDef) / dSum * 0.5 / 1.5 : 0) + extraBonus / (extraBonus + 300));
}

export function stunChance(atkStats: CharStats, defStats: CharStats): number {
  const sum = sv(atkStats, F.stunAtk) + sv(defStats, F.stunDef);
  return sum > 0 ? sv(atkStats, F.stunAtk) / sum * 0.3 : 0;
}

// Урон: мин = level, макс = сила (S)
export function rollDamage(stats: CharStats, level: number): number {
  const S = stats.s;
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

export interface TurnContext {
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

export function runTurn(ctx: TurnContext, addStep: (s: BattleStep) => void): { hpActor: number; hpTarget: number; stunnedTarget: boolean; poisonApplied: { damage: number; turns: number } | undefined } {
  let hpActor = ctx.hpActor;
  let hpTarget = ctx.hpTarget;
  let stunnedTarget = false;
  let poisonApplied: { damage: number; turns: number } | undefined;

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
        maxHp1: ctx.actor === 'attacker' ? ctx.maxHpActor : ctx.maxHpTarget, maxHp2: ctx.actor === 'attacker' ? ctx.maxHpTarget : ctx.maxHpActor });
    }
    return { hpActor, hpTarget, stunnedTarget, poisonApplied: undefined };
  }

  // Попадание
  addStep({ type: 'info', message: `Попадание!` });
  let dmg = rollDamage(ctx.actorStats, ctx.actorLevel);
  // Rage bonus: +% урон при низком HP
  const rageDmg = ctx.actorStats.rageDmg || 0;
  const rageThreshold = ctx.actorStats.rageThreshold || 0.5;
  if (rageDmg > 0 && hpActor < ctx.maxHpActor * rageThreshold) {
    dmg = Math.round(dmg * (1 + rageDmg / 100));
    addStep({ type: 'info', message: `Ярость! +${rageDmg}% урона` });
  }
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
    let blockReduce = blockReduction(ctx.targetStats, ctx.actorStats);
    // BlockPen: reduce block effectiveness
    const blockPen = ctx.actorStats.blockPen || 0;
    if (blockPen > 0) blockReduce = Math.max(0, blockReduce * (1 - blockPen / 100));
    const blocked = dmg * blockReduce;
    dmg -= blocked;
    addStep({ type: 'block', actor: ctx.target, message: `Блок (-${Math.round(blocked)})` });
  }
  dmg = Math.max(0, Math.round(dmg));
  hpTarget = Math.max(0, hpTarget - dmg);
  addStep({ type: 'damage', actor: ctx.actor, target: ctx.target, damage: dmg, message: `Урон: ${dmg}`,
    hp1: ctx.actor === 'attacker' ? hpActor : hpTarget, hp2: ctx.actor === 'attacker' ? hpTarget : hpActor,
    maxHp1: ctx.actor === 'attacker' ? ctx.maxHpActor : ctx.maxHpTarget, maxHp2: ctx.actor === 'attacker' ? ctx.maxHpTarget : ctx.maxHpActor });

  // Vampirism: restore % of damage as HP
  const vamp = ctx.actorStats.vampirism || 0;
  if (vamp > 0 && dmg > 0) {
    const heal = Math.round(dmg * vamp / 100);
    if (heal > 0) {
      hpActor = Math.min(ctx.maxHpActor, hpActor + heal);
      addStep({ type: 'info', message: `Вампиризм +${heal} HP` });
    }
  }

  // Execute: instakill if target < 10% max HP
  if (ctx.actorStats.execute && hpTarget > 0 && hpTarget < ctx.maxHpTarget * 0.1) {
    addStep({ type: 'info', message: `Добивание! ${ctx.targetName} повержен!` });
    hpTarget = 0;
  }

  // CounterOnHit (Страж 4pc): chance to counter when receiving damage
  const counterOnHit = ctx.targetStats.counterOnHit || 0;
  if (counterOnHit > 0 && dmg > 0 && hpTarget > 0 && Math.random() < counterOnHit / 100) {
    addStep({ type: 'counter', actor: ctx.target, message: `${ctx.targetName} отвечает ударом!` });
    let cdmg = Math.round(ctx.targetStats.s * 0.5);
    hpActor = Math.max(0, hpActor - cdmg);
    addStep({ type: 'damage', actor: ctx.target, target: ctx.actor, damage: cdmg, message: `Ответный урон: ${cdmg}`,
      hp1: ctx.actor === 'attacker' ? hpActor : hpTarget, hp2: ctx.actor === 'attacker' ? hpTarget : hpActor,
      maxHp1: ctx.actor === 'attacker' ? ctx.maxHpActor : ctx.maxHpTarget, maxHp2: ctx.actor === 'attacker' ? ctx.maxHpTarget : ctx.maxHpActor });
  }

  // PoisonOnHit (Отшельник 3pc): apply poison DoT over 3 turns
  const poison = ctx.actorStats.poisonOnHit || 0;
  if (poison > 0 && dmg > 0 && hpTarget > 0) {
    const resiliencePct = ctx.targetStats.resiliencePct || 0;
    const poisonTurns = Math.max(1, Math.round(3 * (1 - resiliencePct / 100)));
    const poisonDmg = Math.round(ctx.maxHpTarget * poison / 100);
    poisonApplied = { damage: poisonDmg, turns: poisonTurns };
    addStep({ type: 'info', message: `Яд на ${poisonTurns} хода (-${poisonDmg}/ход)!` });
  }

  if (dmg > 0 && Math.random() < stunChance(ctx.actorStats, ctx.targetStats) * (1 - (ctx.targetStats.resiliencePct || 0) / 100)) {
    stunnedTarget = true;
    addStep({ type: 'stun', actor: ctx.target, message: `${ctx.targetName} оглушён!` });
  }

  return { hpActor, hpTarget, stunnedTarget, poisonApplied: poisonApplied! };
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
  let poisonOnA: { damage: number; turnsLeft: number } | null = null;
  let poisonOnD: { damage: number; turnsLeft: number } | null = null;
  const log: string[] = [];
  const steps: BattleStep[] = [];

  const addStep = (step: BattleStep) => {
    steps.push(step);
    log.push(step.message);
  };

  // Helper: apply poison DoT at start of turn
  const applyPoison = (name: string, actor: 'attacker' | 'defender', hp: number, maxHp: number) => {
    const poison = actor === 'attacker' ? poisonOnA : poisonOnD;
    if (!poison || poison.turnsLeft <= 0) return hp;
    const dmg = Math.min(poison.damage, hp);
    hp = Math.max(0, hp - dmg);
    addStep({ type: 'damage', actor, damage: dmg, message: `${name} получает ${dmg} урона от яда (ходов: ${poison.turnsLeft - 1})`,
      hp1: actor === 'attacker' ? hp : (hpD > 0 ? hpD : 0), hp2: actor === 'attacker' ? (hpA > 0 ? hpA : 0) : hp,
      maxHp1: actor === 'attacker' ? maxHpA : maxHpD, maxHp2: actor === 'attacker' ? maxHpD : maxHpA });
    poison.turnsLeft--;
    if (poison.turnsLeft <= 0) {
      if (actor === 'attacker') poisonOnA = null;
      else poisonOnD = null;
    }
    return hp;
  };

  const maxHpA = statsA.hp;
  const maxHpD = statsD.hp;
  addStep({ type: 'info', message: `⚔ ${attacker.name} vs ${defender.name}`, hp1: hpA, hp2: hpD, maxHp1: maxHpA, maxHp2: maxHpD,
    stats1: { name: attacker.name, level: attacker.level, S: statsA.s, A: statsA.a, D: statsA.d, M: statsA.m, HP: maxHpA,
      drinks: attacker.drinkBonuses, collection: attacker.collectionBonus, guildBonus: attacker.guildBonus },
    stats2: { name: defender.name, level: defender.level, S: statsD.s, A: statsD.a, D: statsD.d, M: statsD.m, HP: maxHpD,
      drinks: defender.drinkBonuses, collection: defender.collectionBonus, guildBonus: defender.guildBonus }
  });

  // Кто ходит первым (Буревестник 3pc = всегда первый)
  let turn: 'A' | 'D';
  if (statsA.alwaysFirst && !statsD.alwaysFirst) {
    turn = 'A';
  } else if (statsD.alwaysFirst && !statsA.alwaysFirst) {
    turn = 'D';
  } else {
    turn = statsA.a >= statsD.a ? 'A' : 'D';
  }
  addStep({ type: 'info', message: `${turn === 'A' ? attacker.name : defender.name} ходит первым` });

  while (hpA > 0 && hpD > 0) {
    if (turn === 'A') {
      // Poison DoT on attacker's turn
      hpA = applyPoison(attacker.name, 'attacker', hpA, maxHpA);
      if (hpA <= 0) break;

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
      if (result.poisonApplied) {
        poisonOnD = { damage: result.poisonApplied.damage, turnsLeft: result.poisonApplied.turns };
      }
      turn = 'D';
    } else {
      // Poison DoT on defender's turn
      hpD = applyPoison(defender.name, 'defender', hpD, maxHpD);
      if (hpD <= 0) break;

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
      if (result.poisonApplied) {
        poisonOnA = { damage: result.poisonApplied.damage, turnsLeft: result.poisonApplied.turns };
      }
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

  // --- ограбление монет (только PvP, не PvE) ---
  let moneyStolen = 0;
  if (attacker.id > 0 && defender.id > 0) {
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
