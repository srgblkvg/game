import { EXTRA_STATS, PRIMARY_STATS } from './stats';

export interface ReforgeItem {
  id?: string | number;
  rarity_id?: number;
  upgradeLevel?: number;
  reforgeCount?: number;
  bonuses?: Record<string, number>;
  extra?: Record<string, any>;
  [key: string]: any;
}

export interface UpgradeRule {
  level: number;
  rarityId: number;
  chance: number;
  moneyCost: number;
}

export interface ForgeSelection {
  item: ReforgeItem;
  targetLevel: number;
}

const REFORGE_BASE_COST: Record<number, number> = {
  0: 500,
  1: 2000,
  2: 7500,
  3: 25000,
  4: 75000,
  5: 150000,
  6: 300000,
  7: 600000,
};

const REFORGE_REPEAT_MULTIPLIERS = [1, 1.5, 2, 3] as const;
const CURSE_RANK_WEIGHTS = [160, 24, 12, 3, 1] as const;

export interface CurseResult {
  stat: string;
  rank: number;
}

export function curseMeetsTarget(curse: CurseResult, targetStat: string | null, minimumRank: number | null): boolean {
  const statMatches = !targetStat || curse.stat === targetStat;
  const rankMatches = minimumRank == null || Number(curse.rank) >= Number(minimumRank);
  return statMatches && rankMatches;
}

export function shouldApplyCurseCandidate(
  current: CurseResult | null,
  candidate: CurseResult,
  targetStat: string | null,
  targetRank: number | null,
): boolean {
  if (!current) return true;
  if (targetStat) {
    const currentStatMatch = current.stat === targetStat;
    const candidateStatMatch = candidate.stat === targetStat;
    if (candidateStatMatch !== currentStatMatch) return candidateStatMatch;
  }
  if (targetRank == null) return false;
  const currentDistance = Math.abs(Number(current.rank) - Number(targetRank));
  const candidateDistance = Math.abs(Number(candidate.rank) - Number(targetRank));
  if (candidateDistance !== currentDistance) return candidateDistance < currentDistance;
  return Number(candidate.rank) > Number(current.rank);
}

export function getTargetCurseChance(targetStat: string, minimumRank: number, attempts: number): number {
  if (!['s', 'a', 'd', 'm'].includes(targetStat)) throw new Error('Неизвестная характеристика проклятия');
  const rank = Number(minimumRank);
  const limit = Number(attempts);
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) throw new Error('Ранг проклятия должен быть от I до V');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Лимит попыток должен быть от 1 до 100, не более 100');
  const totalWeight = CURSE_RANK_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
  const acceptableWeight = CURSE_RANK_WEIGHTS.slice(rank - 1).reduce((sum, weight) => sum + weight, 0);
  const oneAttempt = acceptableWeight / totalWeight / 4;
  return Math.round((1 - Math.pow(1 - oneAttempt, limit)) * 1000) / 10;
}

function statGroup(stat: string): 'primary' | 'extra' | null {
  if ((PRIMARY_STATS as readonly string[]).includes(stat)) return 'primary';
  if ((EXTRA_STATS as readonly string[]).includes(stat)) return 'extra';
  return null;
}

function objectField(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, any>) };
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return {};
}

export function getReforgeCost(item: ReforgeItem): number {
  const rarity = Number(item.rarity_id ?? 0);
  const base = REFORGE_BASE_COST[rarity];
  if (!base) throw new Error('Для этой редкости перековка недоступна');
  const upgradeMultiplier = 1 + Math.max(0, Number(item.upgradeLevel ?? 0)) * 0.1;
  const count = Math.max(0, Number(item.reforgeCount ?? 0));
  const repeatMultiplier = REFORGE_REPEAT_MULTIPLIERS[Math.min(count, REFORGE_REPEAT_MULTIPLIERS.length - 1)]!;
  return Math.round(base * upgradeMultiplier * repeatMultiplier);
}

export function applyReforge(item: ReforgeItem, fromStat: string, toStat: string): ReforgeItem {
  const fromGroup = statGroup(fromStat);
  const toGroup = statGroup(toStat);
  if (!fromGroup || fromGroup !== toGroup) throw new Error('Характеристики должны относиться к одной группе');
  const extra = objectField(item.extra);
  if (fromGroup === 'extra' && (Number(item.rarity_id) === 7 || extra.effect)) {
    throw new Error('Бонусы артефакта нельзя перековывать');
  }
  if (fromStat === toStat) throw new Error('Выберите другую характеристику');

  const field = fromGroup === 'primary' ? 'bonuses' : 'extra';
  const source = objectField(item[field]);
  const value = Number(source[fromStat] || 0);
  if (value <= 0) throw new Error('Исходная характеристика должна иметь положительное значение');

  source[fromStat] = 0;
  source[toStat] = Number(source[toStat] || 0) + value;
  return {
    ...item,
    [field]: source,
    reforgeCount: Math.max(0, Number(item.reforgeCount || 0)) + 1,
  };
}

export function planBatchForge(selections: ForgeSelection[], rules: UpgradeRule[]) {
  if (!Array.isArray(selections) || selections.length === 0) throw new Error('Выберите хотя бы один предмет');
  const seen = new Set<string>();
  const ruleMap = new Map(rules.map(rule => [`${rule.rarityId}:${rule.level}`, rule]));
  let requiredStones = 0;
  let totalCost = 0;

  const entries = selections.map(({ item, targetLevel }) => {
    const id = String(item.id ?? '');
    if (!id) throw new Error('У предмета отсутствует идентификатор');
    if (seen.has(id)) throw new Error('Предмет повторно добавлен в массовую ковку');
    seen.add(id);
    const currentLevel = Math.max(0, Number(item.upgradeLevel || 0));
    const target = Number(targetLevel);
    if (!Number.isInteger(target) || target <= currentLevel) throw new Error('Целевой уровень должен быть выше текущего');
    if (target > 10) throw new Error('Максимальный уровень ковки: +10');

    const levels: number[] = [];
    const levelRules: UpgradeRule[] = [];
    for (let level = currentLevel + 1; level <= target; level++) {
      const rule = ruleMap.get(`${Number(item.rarity_id)}:${level}`);
      if (!rule) throw new Error(`Нет данных для уровня +${level}`);
      levels.push(level);
      levelRules.push(rule);
      requiredStones += 1;
      totalCost += rule.moneyCost;
    }
    return { itemId: id, currentLevel, targetLevel: target, levels, rules: levelRules };
  });

  return { entries, requiredStones, totalCost };
}
