import { currentStats, CharStats, GameItem } from './stats';

export interface BattleStep {
  type: 'attack' | 'dodge' | 'counter' | 'block' | 'fullBlock' | 'crit' | 'stun' | 'damage' | 'info' | 'end' | 'money';
  actor?: 'attacker' | 'defender';
  target?: 'attacker' | 'defender';
  message: string;
  damage?: number;
  amount?: number;
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

const dodgeChance = (defA: number, atkM: number, defExtraDodge: number) =>
  Math.max(0, (defA / (defA + 50)) * (1 - atkM / (atkM + 100)) + Math.min(0.5, defExtraDodge / 200));

const critChance = (m: number, extraCrit: number) => Math.min(0.8, m / (m + 50) + extraCrit / 200);
const critMult = (m: number) => 1.5 + 0.5 * (m / (m + 50));

const blockChance = (d: number, extraFullBlock: number) => Math.min(1, d / (d + 50) + extraFullBlock / 200);
const blockRed = (d: number, s: number) => {
  const ratio = d / Math.max(1, s);
  return Math.min(0.75, 0.5 * ratio);
};

const counterChance = (defStats: CharStats, atkStats: CharStats, defExtraCounter: number) => {
  const sum = (defStats.m + defStats.a) + (atkStats.m + atkStats.d);
  return Math.min(0.5, (sum > 0 ? (defStats.m + defStats.a) / sum * 0.5 : 0) + defExtraCounter / 200);
};

const stunChance = (atkStats: CharStats, defStats: CharStats) => {
  const sum = (atkStats.s + atkStats.m) + (defStats.s + defStats.d);
  return sum > 0 ? (atkStats.s + atkStats.m) / sum * 0.3 : 0;
};

export function runBattle(
  attacker: { id: number; name: string; base: any; equipment: Record<string, GameItem>; level: number; money: number; currentHp?: number; drinkBonuses?: { s: number; a: number; d: number; m: number }; collectionBonus?: number },
  defender: { id: number; name: string; base: any; equipment: Record<string, GameItem>; level: number; money: number; currentHp?: number; drinkBonuses?: { s: number; a: number; d: number; m: number }; collectionBonus?: number }
): BattleResult {
  const statsA = currentStats(attacker.base, attacker.equipment, attacker.drinkBonuses, attacker.collectionBonus);
  const statsD = currentStats(defender.base, defender.equipment, defender.drinkBonuses, defender.collectionBonus);
  let hpA = attacker.currentHp ?? statsA.hp;
  let hpD = defender.currentHp ?? statsD.hp;
  let stunnedA = false;
  let stunnedD = false;
  const log: string[] = [];
  const steps: BattleStep[] = [];

  const addStep = (step: BattleStep) => {
    steps.push(step);
    log.push(step.message);
  };

  addStep({ type: 'info', message: `⚔ ${attacker.name} vs ${defender.name}` });
  let turn: 'A' | 'D' = statsA.a >= statsD.a ? 'A' : 'D';
  addStep({ type: 'info', message: `${turn === 'A' ? attacker.name : defender.name} ходит первым` });

  let turns = 0;
  while (hpA > 0 && hpD > 0) {
    turns++;
    if (turn === 'A') {
      // Ход атакующего (игрок)
      if (stunnedA) {
        addStep({ type: 'stun', actor: 'attacker', message: `${attacker.name} оглушён и пропускает ход` });
        stunnedA = false;
        turn = 'D';
        continue;
      }
      addStep({ type: 'attack', actor: 'attacker', message: `${attacker.name} атакует!` });

      if (Math.random() < dodgeChance(statsD.a, statsA.m, statsD.extra.dodge)) {
        addStep({ type: 'dodge', actor: 'defender', message: `${defender.name} уклоняется!` });
        if (Math.random() < counterChance(statsD, statsA, statsD.extra.counter)) {
          addStep({ type: 'counter', actor: 'defender', message: `${defender.name} контратакует!` });
          let cdmg = statsD.s;
          if (Math.random() < critChance(statsD.m, statsD.extra.crit)) {
            cdmg *= critMult(statsD.m);
            addStep({ type: 'crit', actor: 'defender', message: `Крит!` });
          }
          cdmg = Math.max(0, Math.round(cdmg));
          addStep({ type: 'damage', actor: 'defender', target: 'attacker', damage: cdmg, message: `Урон: ${cdmg}` });
          hpA = Math.max(0, hpA - cdmg);
        }
        turn = 'D';
        continue;
      }

      // Попадание
      addStep({ type: 'info', message: `Попадание!` });
      let dmg = statsA.s > attacker.level
        ? Math.floor(attacker.level + Math.random() * (statsA.s - attacker.level + 1))
        : statsA.s;
      if (Math.random() < critChance(statsA.m, statsA.extra.crit)) {
        dmg *= critMult(statsA.m);
        addStep({ type: 'crit', actor: 'attacker', message: `Крит!` });
      }
      const fullBlockChance = statsD.extra.fullBlock / 100;
      if (Math.random() < fullBlockChance) {
        dmg = 0;
        addStep({ type: 'fullBlock', actor: 'defender', message: `ПОЛНЫЙ БЛОК!` });
      } else if (Math.random() < blockChance(statsD.d, 0)) {
        const blocked = dmg * blockRed(statsD.d, statsA.s);
        dmg -= blocked;
        addStep({ type: 'block', actor: 'defender', message: `Блок (-${Math.round(blocked)})` });
      }
      dmg = Math.max(0, Math.round(dmg));
      addStep({ type: 'damage', actor: 'attacker', target: 'defender', damage: dmg, message: `Урон: ${dmg}` });
      hpD = Math.max(0, hpD - dmg);
      if (dmg > 0 && Math.random() < stunChance(statsA, statsD)) {
        stunnedD = true;
        addStep({ type: 'stun', actor: 'defender', message: `${defender.name} оглушён!` });
      }
      turn = 'D';
    } else {
      // Ход защитника (бот)
      if (stunnedD) {
        addStep({ type: 'stun', actor: 'defender', message: `${defender.name} оглушён и пропускает ход` });
        stunnedD = false;
        turn = 'A';
        continue;
      }
      addStep({ type: 'attack', actor: 'defender', message: `${defender.name} атакует!` });

      if (Math.random() < dodgeChance(statsA.a, statsD.m, statsA.extra.dodge)) {
        addStep({ type: 'dodge', actor: 'attacker', message: `${attacker.name} уклоняется!` });
        if (Math.random() < counterChance(statsA, statsD, statsA.extra.counter)) {
          addStep({ type: 'counter', actor: 'attacker', message: `${attacker.name} контратакует!` });
          let cdmg = statsA.s;
          if (Math.random() < critChance(statsA.m, statsA.extra.crit)) {
            cdmg *= critMult(statsA.m);
            addStep({ type: 'crit', actor: 'attacker', message: `Крит!` });
          }
          cdmg = Math.max(0, Math.round(cdmg));
          addStep({ type: 'damage', actor: 'attacker', target: 'defender', damage: cdmg, message: `Урон: ${cdmg}` });
          hpD = Math.max(0, hpD - cdmg);
        }
        turn = 'A';
        continue;
      }

      addStep({ type: 'info', message: `Попадание!` });
      let dmg = statsD.s > defender.level
        ? Math.floor(defender.level + Math.random() * (statsD.s - defender.level + 1))
        : statsD.s;
      if (Math.random() < critChance(statsD.m, statsD.extra.crit)) {
        dmg *= critMult(statsD.m);
        addStep({ type: 'crit', actor: 'defender', message: `Крит!` });
      }
      const fullBlockChance = statsA.extra.fullBlock / 100;
      if (Math.random() < fullBlockChance) {
        dmg = 0;
        addStep({ type: 'fullBlock', actor: 'attacker', message: `ПОЛНЫЙ БЛОК!` });
      } else if (Math.random() < blockChance(statsA.d, 0)) {
        const blocked = dmg * blockRed(statsA.d, statsD.s);
        dmg -= blocked;
        addStep({ type: 'block', actor: 'attacker', message: `Блок (-${Math.round(blocked)})` });
      }
      dmg = Math.max(0, Math.round(dmg));
      addStep({ type: 'damage', actor: 'defender', target: 'attacker', damage: dmg, message: `Урон: ${dmg}` });
      hpA = Math.max(0, hpA - dmg);
      if (dmg > 0 && Math.random() < stunChance(statsD, statsA)) {
        stunnedA = true;
        addStep({ type: 'stun', actor: 'attacker', message: `${attacker.name} оглушён!` });
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
    moneyGained = 10;
  } else {
    if (attacker.level > defender.level) expGained = 2;
    else if (attacker.level === defender.level) expGained = 1;
  }

  // --- ограбление монет ---
  let moneyStolen = 0;
  const loserId = winnerId === attacker.id ? defender.id : attacker.id;
  const loserMoney = loserId === defender.id ? defender.money || 0 : attacker.money || 0;
  if (loserMoney > 0) {
    const percent = 0.1 + Math.random() * 0.4; // 10% – 50%
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
