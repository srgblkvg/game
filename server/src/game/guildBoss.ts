import { db } from '../db/index';

// ── Константы босса ──
export const BOSS_BASE_HP = 100_000;
export const BOSS_BASE_STATS = { s: 80, a: 50, d: 60, m: 50 };
export const BOSS_BASE_LEVEL = 20;
export const BOSS_HP_PER_KILL = 50_000;
export const BOSS_STAT_SCALE = 0.10; // +10% статов за убийство
export const BOSS_LEVEL_PER_KILL = 5;
export const BOSS_COOLDOWN = 3600; // 1 час

// ── Случайные эффекты босса после перерождения ──

interface BossEffect {
  name: string;
  effect: Record<string, any>;
  baseValue: number; // базовое значение, скейлится с killCount
}

const BOSS_EFFECT_POOL: BossEffect[] = [
  { name: 'Сверх-уклонение', baseValue: 30, effect: {} },        // extra.dodge
  { name: 'Сверх-блок', baseValue: 30, effect: {} },              // extra.fullBlock
  { name: 'Вампиризм', baseValue: 10, effect: {} },               // vampirism
  { name: 'Ядовитость', baseValue: 3, effect: {} },               // poisonOnHit
  { name: 'Контратака', baseValue: 20, effect: {} },              // counterOnHit
  { name: 'Ярость', baseValue: 20, effect: {} },                  // rageDmg
  { name: 'Пробивание блока', baseValue: 15, effect: {} },        // blockPen
  { name: 'Удача', baseValue: 5, effect: {} },                     // luckBoost
  { name: 'Стойкость', baseValue: 20, effect: {} },               // resiliencePct
  { name: 'Сокрушительный удар', baseValue: 25, effect: {} },     // extra.crit
  { name: 'Всегда первый', baseValue: 0, effect: {} },            // alwaysFirst (бинарный)
  { name: 'Добивание', baseValue: 0, effect: {} },                // execute (бинарный)
];

const MAX_BOSS_EFFECTS = 6;

/** Построить объект эффекта с учётом скейлинга от killCount */
function buildEffectScaled(eff: BossEffect, killCount: number): Record<string, any> {
  // alwaysFirst и execute — бинарные, не скейлятся
  if (eff.name === 'Всегда первый') return { alwaysFirst: true };
  if (eff.name === 'Добивание') return { execute: true };

  const scaled = Math.round(eff.baseValue * (1 + BOSS_STAT_SCALE * killCount));

  switch (eff.name) {
    case 'Сверх-уклонение': return { extra: { dodge: scaled } };
    case 'Сверх-блок': return { extra: { fullBlock: scaled } };
    case 'Сокрушительный удар': return { extra: { crit: scaled } };
    default: {
      const keyMap: Record<string, string> = {
        'Вампиризм': 'vampirism', 'Ядовитость': 'poisonOnHit',
        'Контратака': 'counterOnHit', 'Ярость': 'rageDmg',
        'Пробивание блока': 'blockPen', 'Удача': 'luckBoost',
        'Стойкость': 'resiliencePct',
      };
      const prop = keyMap[eff.name]!;
      const result: Record<string, any> = {};
      result[prop] = scaled;
      return result;
    }
  }
}

function pickBossEffects(killCount: number): { name: string; effect: Record<string, any> }[] {
  if (killCount <= 0) return [];
  const count = Math.min(killCount, MAX_BOSS_EFFECTS);
  const shuffled = [...BOSS_EFFECT_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(e => ({
    name: e.name,
    effect: buildEffectScaled(e, killCount),
  }));
}

/** Сжать эффекты босса в плоский объект для Object.assign в бою */
export function flattenBossEffects(effects: { name: string; effect: Record<string, any> }[]): Record<string, any> {
  const result: Record<string, any> = { extra: {} };
  for (const e of effects) {
    for (const [key, val] of Object.entries(e.effect)) {
      if (key === 'extra' && typeof val === 'object') {
        Object.assign(result.extra, val);
      } else {
        result[key] = val;
      }
    }
  }
  if (Object.keys(result.extra).length === 0) delete result.extra;
  return result;
}

// ── Деревья талантов ──
export const TALENT_TYPES = ['accuracy', 'fortitude', 'penetration', 'control', 'vampiric'] as const;
export type TalentType = typeof TALENT_TYPES[number];

export const TALENT_LABELS: Record<TalentType, string> = {
  accuracy: 'Меткость',
  fortitude: 'Стойкость',
  penetration: 'Пробивание',
  control: 'Контроль',
  vampiric: 'Антивампиризм',
};

export const TALENT_DESCS: Record<TalentType, string> = {
  accuracy: '−1% вражеского уклонения за уровень',
  fortitude: '−1% вражеского крита за уровень',
  penetration: '−1% вражеского блока за уровень',
  control: '−1% вражеской контратаки за уровень',
  vampiric: '−1% вражеского вампиризма за уровень',
};

// Эффект одного уровня таланта на вражеский экстра-стат (проценты)
const TALENT_EFFECT_PER_LEVEL = 1;

/** Стоимость прокачки таланта: 10 * 2^currentLevel */
export function getTalentUpgradeCost(currentLevel: number): number {
  return 10 * Math.pow(2, currentLevel);
}

// ── Статы босса ──

export interface BossStats {
  s: number; a: number; d: number; m: number;
  hp: number; level: number; killCount: number;
}

function scaleStat(base: number, killCount: number): number {
  return Math.round(base * (1 + BOSS_STAT_SCALE * killCount));
}

export function getBossStats(killCount: number): BossStats {
  return {
    s: scaleStat(BOSS_BASE_STATS.s, killCount),
    a: scaleStat(BOSS_BASE_STATS.a, killCount),
    d: scaleStat(BOSS_BASE_STATS.d, killCount),
    m: scaleStat(BOSS_BASE_STATS.m, killCount),
    hp: BOSS_BASE_HP + BOSS_HP_PER_KILL * killCount,
    level: BOSS_BASE_LEVEL + BOSS_LEVEL_PER_KILL * killCount,
    killCount,
  };
}

export async function getOrCreateBoss(guildId: number): Promise<{ currentHp: number; maxHp: number; atk: number; agi: number; def: number; mst: number; level: number; killCount: number; effects: { name: string; effect: Record<string, any> }[] }> {
  let boss = await db.one('SELECT * FROM guild_bosses WHERE guildId = ?', [guildId]).catch(() => null) as any;
  if (!boss) {
    const stats = getBossStats(0);
    const effects = pickBossEffects(0);
    await db.run(
      'INSERT INTO guild_bosses (guildId, killCount, currentHp, maxHp, atk, agi, def, mst, level, effects) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?)',
      [guildId, stats.hp, stats.hp, stats.s, stats.a, stats.d, stats.m, stats.level, JSON.stringify(effects)]
    );
    boss = { guildId, killcount: 0, currenthp: stats.hp, maxhp: stats.hp, atk: stats.s, agi: stats.a, def: stats.d, mst: stats.m, level: stats.level, effects: JSON.stringify(effects) };
  }
  let parsedEffects: { name: string; effect: Record<string, any> }[] = [];
  try { parsedEffects = typeof boss.effects === 'string' ? JSON.parse(boss.effects) : (boss.effects || []); } catch {}
  return {
    currentHp: boss.currenthp,
    maxHp: boss.maxhp,
    atk: boss.atk,
    agi: boss.agi,
    def: boss.def,
    mst: boss.mst,
    level: boss.level,
    killCount: boss.killcount,
    effects: parsedEffects,
  };
}

export async function damageBoss(guildId: number, damage: number): Promise<{ killed: boolean; newKillCount: number; newEffects?: { name: string; effect: Record<string, any> }[] }> {
  const boss = await db.one('SELECT * FROM guild_bosses WHERE guildId = ?', [guildId]) as any;
  const newHp = Math.max(0, boss.currenthp - damage);
  const killed = newHp <= 0;

  if (killed) {
    const newKillCount = boss.killcount + 1;
    const stats = getBossStats(newKillCount);
    const newEffects = pickBossEffects(newKillCount);
    await db.run(
      'UPDATE guild_bosses SET killCount = ?, currentHp = ?, maxHp = ?, atk = ?, agi = ?, def = ?, mst = ?, level = ?, effects = ? WHERE guildId = ?',
      [newKillCount, stats.hp, stats.hp, stats.s, stats.a, stats.d, stats.m, stats.level, JSON.stringify(newEffects), guildId]
    );
    return { killed: true, newKillCount, newEffects };
  } else {
    await db.run('UPDATE guild_bosses SET currentHp = ? WHERE guildId = ?', [newHp, guildId]);
    return { killed: false, newKillCount: boss.killcount };
  }
}

// ── Таланты ──

export async function getGuildTalents(guildId: number) {
  const rows = await db.query('SELECT talentType, level FROM guild_talents WHERE guildId = ?', [guildId]) as any[];
  const talents: Record<string, number> = {};
  for (const t of TALENT_TYPES) talents[t] = 0;
  for (const r of rows) talents[r.talenttype] = r.level;
  return talents;
}

export async function getPlayerTalents(userId: number, guildId: number) {
  const rows = await db.query('SELECT talentType, level FROM player_guild_talents WHERE userId = ? AND guildId = ?', [userId, guildId]) as any[];
  const talents: Record<string, number> = {};
  for (const t of TALENT_TYPES) talents[t] = 0;
  for (const r of rows) talents[r.talenttype] = r.level;
  return talents;
}

/** Суммарный контр-бонус от личных + гильдийских талантов */
export function getTalentAntiBonus(
  playerTalents: Record<string, number>,
  guildTalents: Record<string, number>,
  talentType: TalentType
): number {
  return ((playerTalents[talentType] || 0) + (guildTalents[talentType] || 0)) * TALENT_EFFECT_PER_LEVEL;
}

/** Получить все поля anti-* для передачи в TurnContext */
export function getAntiStats(
  playerTalents: Record<string, number>,
  guildTalents: Record<string, number>
): { antiDodge: number; antiCrit: number; antiBlock: number; antiCounter: number; antiVampiric: number } {
  return {
    antiDodge: getTalentAntiBonus(playerTalents, guildTalents, 'accuracy'),
    antiCrit: getTalentAntiBonus(playerTalents, guildTalents, 'fortitude'),
    antiBlock: getTalentAntiBonus(playerTalents, guildTalents, 'penetration'),
    antiCounter: getTalentAntiBonus(playerTalents, guildTalents, 'control'),
    antiVampiric: getTalentAntiBonus(playerTalents, guildTalents, 'vampiric'),
  };
}
