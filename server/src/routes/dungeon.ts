import { Router } from 'express';
import { db } from '../db/index';
import { buildPlayerStats, getBaseStats } from '../db/helpers';
import { dodgeChance, critChance, critMult, blockChance, blockReduction, counterChance, rollDamage } from '../game/battle';
import type { BattleAntiStats } from '../game/battle';
import { currentStats } from '../game/stats';
import { sendToUser, markDirty } from '../events';
import { advanceEnemyAttack, cancelEnemyWindup, ENEMY_WINDUP_MS } from '../game/dungeonWindup';
import { loadBattleAntiStats } from '../game/guildBoss';
import { payDungeonLoot, restartDungeonRunAfterFailedPayout } from '../game/dungeonPayout';
import { createPgDungeonPayoutRepository } from '../game/dungeonPayoutRepository';

const router = Router();

// ═══════ ТАБЛИЦЫ ═══════

// ═══════ КОНСТАНТЫ ═══════

const WEAPON_SPEED: Record<number, number> = { 0: 0.3, 1: 0.5, 2: 0.7, 3: 0.9, 4: 1.1, 5: 1.3, 6: 1.5 };
const TICK_MS = 100;
const COMBAT_SPEED = 1/3; // замедление боя в 3 раза
const DAILY_RUNS_MAX = 4;
const BASE_SKILL_IDS = new Set([7, 2, 3, 1]); // Рывок, Размах, Боевой клич, Удар щитом

function getHpRegenRate(user: any): number {
    const now = Math.floor(Date.now() / 1000);
    let rate = 1; // базовый: 1 HP за 5 сек
    if (user.roomtype && (user.roomuntil || 0) > now) {
        if (user.roomtype === 'closet') rate = 3;
        else if (user.roomtype === 'bed') rate = 10;
        else if (user.roomtype === 'chamber') rate = 50;
        else if (user.roomtype === 'lux') rate = 250;
    }
    if ((user.premiumuntil || 0) > now) rate *= 3;
    return rate;
}

interface EnemyData {
    id: number; name: string; hp: number; maxHp: number; dmg: number;
    isBoss: boolean; stunTimer?: number; debuffs?: Record<string, any>;
    _lastAttack?: number; image?: string; _attackInterval?: number;
    _lastAttackTime?: number;
    _windupStartedAtMs?: number | null;
}

interface Skill {
    id: number; name: string; nameRu: string; rageCost: number; rageGain: number; cooldown: number;
    desc: string; descScale: string; icon: string;
}

const SKILLS: Skill[] = [
    { id: 1, name: 'shield_bash', nameRu: 'Удар щитом', rageCost: 5, rageGain: 0, cooldown: 6,
      icon: '🛡️', desc: 'Оглушение', descScale: '+0.2с стана, +10% урона' },
    { id: 2, name: 'sweep', nameRu: 'Размах', rageCost: 15, rageGain: 0, cooldown: 5,
      icon: '⚔️', desc: 'Цель и соседние враги', descScale: '+10% урона' },
    { id: 3, name: 'battle_cry', nameRu: 'Боевой клич', rageCost: 20, rageGain: 0, cooldown: 20,
      icon: '📢', desc: '+20% урона', descScale: '+5% урона, +1с длительности' },
    { id: 4, name: 'rend', nameRu: 'Раздирание', rageCost: 10, rageGain: 0, cooldown: 0,
      icon: '🩸', desc: 'Кровотечение 9с', descScale: '+5% урона за тик' },
    { id: 5, name: 'execute', nameRu: 'Добивание', rageCost: 30, rageGain: 0, cooldown: 8,
      icon: '💀', desc: '<30% HP', descScale: '+25% урона' },
    { id: 6, name: 'demoralize', nameRu: 'Деморализация', rageCost: 10, rageGain: 0, cooldown: 25,
      icon: '😨', desc: '-10% урона от врага', descScale: '-2% урона, +2с' },
    { id: 7, name: 'charge', nameRu: 'Рывок', rageCost: 0, rageGain: 12, cooldown: 15,
      icon: '🏃', desc: 'Стан 1с', descScale: '+0.2с стана, +3 ярости' },
    { id: 8, name: 'whirlwind', nameRu: 'Вихрь', rageCost: 25, rageGain: 0, cooldown: 10,
      icon: '🌀', desc: 'Все враги', descScale: '+10% урона' },
];

// Хелпер: получить бонус от уровня скилла (level >= 1)
function skillBonus(level: number, perLevel: number): number {
    return (level - 1) * perLevel;
}

// ═══════ БОЕВОЙ ДВИЖОК В ПАМЯТИ ═══════

interface DungeonRun {
    userId: number; currentFloor: number; checkpointFloor: number;
    playerHp: number; playerMaxHp: number; playerStr: number; playerAgi: number;
    playerDef: number; playerMag: number; playerLevel: number;
    playerExtra: any; playerVamp: number; playerAntiStats: BattleAntiStats;
 equippedWeaponRarity: number;
 equippedWeaponStr: number;
 enemies: EnemyData[];
    rage: number; autoTimer: number; lastPlayerAttackAt: number;
    skills: SkillWithLevel[];
    buffs: Record<string, { endsAt: number; value: number }>;
    skillCooldowns: Record<number, number>;
    startedAt: number; dailyRuns: number; dailyRunDate: string;
    tickTimer: ReturnType<typeof setInterval> | null;
    log: string[];
    lastHpUpdate: number;
    regenRate: number;
    cleared: boolean;
    targetIndex: number;
    accumulatedLoot: { silver: number; items: any[]; pages: any[] };
}

function getTarget(run: DungeonRun): EnemyData | undefined {
    return run.enemies[run.targetIndex];
}

function interruptEnemyAttack(enemy: EnemyData): boolean {
    const interrupted = enemy._windupStartedAtMs != null;
    const reset = cancelEnemyWindup({
        attackElapsedMs: (enemy._lastAttack || 0) * 1000,
        attackIntervalMs: (enemy._attackInterval || 2.5) * 1000,
        windupStartedAtMs: enemy._windupStartedAtMs ?? null,
    });
    enemy._lastAttack = reset.attackElapsedMs / 1000;
    enemy._windupStartedAtMs = reset.windupStartedAtMs;
    enemy._lastAttackTime = Date.now() / 1000;
    return interrupted;
}

const activeRuns = new Map<number, DungeonRun>();
const finishingRuns = new Set<number>();

/** Number of in-memory dungeon runs that would be interrupted by a restart. */
export function getActiveDungeonRunsCount(): number {
    return activeRuns.size;
}

/**
 * Закрывает активные походы перед плановым рестартом и выдаёт накопленный лут.
 * Использует тот же payout-путь, что и обычная кнопка «Выйти».
 */
export async function forceFinishActiveDungeonRuns(): Promise<{ finished: number; userIds: number[] }> {
    const runs = Array.from(activeRuns.entries());
    const userIds: number[] = [];
    for (const [userId, run] of runs) {
        if (finishingRuns.has(userId)) continue;
        finishingRuns.add(userId);
        if (run.tickTimer) clearInterval(run.tickTimer);
        activeRuns.delete(userId);
        const loot = run.accumulatedLoot || { silver: 0, items: [], pages: [] };
        try {
            await payDungeonLoot(createPgDungeonPayoutRepository(), {
                userId,
                loot,
                currentFloor: run.currentFloor,
                startedAt: Math.floor(Date.now() / 1000),
            });
            sendToUser(userId, {
                type: 'dungeonForceFinished',
                loot,
                message: `Поход в подземелье завершён перед перезагрузкой. Награда выдана: ${loot.silver} серебра.`,
            });
            markDirty(userId, 'quests', 'notifications');
            userIds.push(userId);
        } catch (error) {
            // Транзакция откатила выплату — возвращаем run, чтобы повторить безопасно.
            restartDungeonRunAfterFailedPayout(run, () => setInterval(() => tickCombat(run), TICK_MS));
            activeRuns.set(userId, run);
            throw error;
        } finally {
            finishingRuns.delete(userId);
        }
    }
    return { finished: userIds.length, userIds };
}

function getAttackSpeed(rarity: number, weaponStrBonus: number): number {
    const base = WEAPON_SPEED[rarity] ?? 0.5;
    // Замедление от силы оружия (небольшое: +20 силы ≈ -10% скорости)
    return Math.max(0.3, base / (1 + weaponStrBonus * 0.005));
}

function calcPlayerDamage(run: DungeonRun): { damage: number; isCrit: boolean; dodged: boolean; blocked: boolean; counterDmg: number; vampHeal: number } {
    const stats = { s: run.playerStr, a: run.playerAgi, d: run.playerDef, m: run.playerMag, hp: run.playerMaxHp, extra: (run.playerExtra || {}) as any, bonuses: {} as any, vampirism: run.playerVamp || 0 } as any;
    const target = run.enemies[run.targetIndex];
    if (!target) return { damage: 0, isCrit: false, dodged: false, blocked: false, counterDmg: 0, vampHeal: 0 };
    
    // Статы врага для формул
    const mobStats = { s: target.dmg, a: target.dmg, d: Math.floor(target.dmg * 0.5), m: Math.floor(target.dmg * 0.3), hp: target.maxHp, extra: {}, bonuses: {} } as any;
    
    // Проверка уклонения врага — снижается меткостью игрока
    const dodge = Math.max(0, dodgeChance(mobStats, stats) - run.playerAntiStats.antiDodge / 100);
    if (Math.random() < dodge) {
        run.log.push(`↗ ${target.name} уклоняется`);
        return { damage: 0, isCrit: false, dodged: true, blocked: false, counterDmg: 0, vampHeal: 0 };
    }
    
    // Урон и крит
    const dmg = rollDamage(stats, run.playerLevel);
    const isCrit = Math.random() < critChance(stats);
    let finalDmg = Math.floor(isCrit ? dmg * critMult(stats) : dmg);
    
    // fullBlock врага — снижается пробиванием игрока
    const fb = mobStats.extra?.fullBlock || 0;
    const fullBlockChance = Math.max(0, fb / (fb + 300) - run.playerAntiStats.antiBlock / 100);
    if (Math.random() < fullBlockChance) {
        run.log.push(`🛡 ${target.name} — полный блок!`);
        return { damage: 0, isCrit: false, dodged: false, blocked: true, counterDmg: 0, vampHeal: 0 };
    }
    
    // Блок врага
    let blocked = false;
    if (Math.random() < Math.max(0, blockChance(mobStats) - run.playerAntiStats.antiBlock / 100)) {
        let blockRed = blockReduction(mobStats, stats);
        const blockPen = stats.blockPen || 0;
        if (blockPen > 0) blockRed = Math.max(0, blockRed * (1 - blockPen / 100));
        finalDmg = Math.max(1, Math.floor(finalDmg * (1 - blockRed)));
        blocked = true;
    }
    
    // Battle cry бонус
    const bcBonus = run.buffs['battle_cry'] ? (1 + run.buffs['battle_cry'].value / 100) : 1;
    finalDmg = Math.floor(finalDmg * bcBonus);
    
    // Вампиризм
    let vampHeal = 0;
    const vamp = stats.vampirism || 0;
    if (vamp > 0 && finalDmg > 0) {
        vampHeal = Math.round(finalDmg * vamp / 100);
    }
    
    // Execute: добивание при <10% HP
    if (stats.extra?.execute && target.hp > 0 && target.hp < target.maxHp * 0.1) {
        run.log.push(`💀 Добивание!`);
        return { damage: target.hp, isCrit: false, dodged: false, blocked: false, counterDmg: 0, vampHeal };
    }
    
    return { damage: finalDmg, isCrit, dodged: false, blocked, counterDmg: 0, vampHeal };
}

function calcEnemyDamage(enemy: EnemyData, playerStats: any, floor: number): { damage: number; dodged: boolean; blocked: boolean } {
    const stats = { s: enemy.dmg, a: enemy.dmg, d: Math.floor(enemy.dmg * 0.5), m: Math.floor(enemy.dmg * 0.3), hp: enemy.maxHp, extra: {}, bonuses: {} } as any;
    
    // Проверка уклонения игрока
    const dodge = dodgeChance(playerStats, stats);
    if (Math.random() < dodge) {
        return { damage: 0, dodged: true, blocked: false };
    }
    
    // Урон врага
    const base = enemy.dmg + Math.floor(floor * 0.3);
    const debuffPct = enemy.debuffs?.['demoralize']?.value || 0;
    const debuff = 1 - debuffPct / 100;
    let dmg = Math.floor((base + Math.random() * 2) * debuff);
    
    // fullBlock игрока
    const fb = playerStats.extra?.fullBlock || 0;
    const fullBlockChance = fb / (fb + 300);
    if (Math.random() < fullBlockChance) {
        return { damage: 0, dodged: false, blocked: true };
    }
    
    // Блок игрока
    if (Math.random() < blockChance(playerStats)) {
        const blockRed = blockReduction(playerStats, stats);
        dmg = Math.max(1, Math.floor(dmg * (1 - blockRed)));
        return { damage: dmg, dodged: false, blocked: true };
    }
    
    return { damage: dmg, dodged: false, blocked: false };
}

// Кеш мобов — загружается один раз
let _mobCache: any[] | null = null;
async function loadMobs(): Promise<any[]> {
    if (!_mobCache) _mobCache = await db.query('SELECT name, background, level, hp, atk FROM mobs');
    return _mobCache!;
}

function generateEnemyFromMob(mob: any, floor: number, isBoss: boolean): EnemyData {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    // Начальные этажи слабее, высокие сильнее
    const scale = 0.3 + floor * 0.8;
    const hp = Math.floor((mob.hp || 10) * scale * (isBoss ? 5 : 1));
    const dmg = Math.floor((mob.atk || 3) * scale);
    const interval = isBoss ? 1.5 + Math.random() * 1.0 : 1.0 + Math.random() * 2.0; // босс 1.5-2.5с, обычный 1.0-3.0с
    // Более сильные монстры атакуют быстрее (atk влияет на скорость)
    const speedBonus = Math.max(0, (1 - (mob.atk || 3) / 20) * 1.0); // atk=3 → +1.0с, atk=20 → +0с
    const finalInterval = Math.max(0.8, interval + speedBonus * Math.random()) / COMBAT_SPEED; // реальные секунды
    return { id, name: mob.name, hp, maxHp: hp, dmg, isBoss, image: mob.background || '', _attackInterval: finalInterval, _lastAttackTime: Math.floor(Date.now() / 1000) };
}

async function generateFloorEnemies(floor: number): Promise<EnemyData[]> {
    const isBoss = floor % 5 === 0;
    const mobs = await loadMobs();
    // Фильтруем мобов по этажу: ATK не должен превышать floor * 15
    const maxAtk = floor * 15;
    const floorMobs = mobs.filter(m => m.atk <= maxAtk);
    if (floorMobs.length === 0) floorMobs.push(...mobs); // fallback
    const enemies: EnemyData[] = [];

    if (isBoss) {
        // Босс — берём сильнейшего из доступных
        const candidates = [...floorMobs].sort((a, b) => b.atk - a.atk);
        enemies.push(generateEnemyFromMob(candidates[0], floor, true));
    } else {
        const count = 2 + Math.floor(Math.random() * 3); // 2-4 моба
        const shuffled = [...floorMobs].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(count, shuffled.length); i++) {
            enemies.push(generateEnemyFromMob(shuffled[i], floor, false));
        }
    }
    return enemies;
}

interface SkillWithLevel extends Skill {
    level: number;
}

function getAvailableSkills(userId: number, equippedSkills: number[]): Promise<SkillWithLevel[]> {
    return (async () => {
        const levels = await db.query('SELECT skillId, level FROM skill_levels WHERE userId = ?', [userId]) as any[];
        const levelMap: Record<number, number> = {};
        for (const r of levels) levelMap[r.skillid] = r.level;

        // Базовые умения имеют минимум 1 уровень
        return SKILLS.filter(s => equippedSkills.includes(s.id)).map(s => ({
            ...s,
            level: Math.max(BASE_SKILL_IDS.has(s.id) ? 1 : 0, levelMap[s.id] || 0),
        }));
    })();
}

// ═══════ ЭНДПОИНТЫ ═══════

// Статус данжа (вне боя)
router.get('/dungeon/status', async (req, res) => {
    const userId = req.userId;

    const active = activeRuns.get(userId);
    if (active) {
        // Мёртвый ран — чистим, возвращаем неактивный статус
        if (active.playerHp <= 0) {
            if (active.tickTimer) clearInterval(active.tickTimer);
            activeRuns.delete(userId);
        } else {
            return res.json({
                active: true,
                currentFloor: active.currentFloor,
                checkpointFloor: active.checkpointFloor,
                playerHp: active.playerHp,
                playerMaxHp: active.playerMaxHp,
                enemies: active.enemies.map(e => ({ id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, isBoss: e.isBoss })),
                rage: active.rage,
                cleared: active.cleared,
            });
        }
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastRun = await db.one(
        'SELECT dailyRuns, dailyRunDate, startedAt FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;

    const dailyRuns = (lastRun && lastRun.dailyrundate === today) ? lastRun.dailyruns : 0;
    const remainingRuns = Math.max(0, DAILY_RUNS_MAX - dailyRuns);

    // Кулдаун 6 часов с последнего захода
    const cdRemaining = lastRun?.startedat
        ? Math.max(0, 30 * 60 - (Math.floor(Date.now() / 1000) - lastRun.startedat))
        : 0;

    // Чекпоинт — с какого этажа можно начать
    const checkpointRow = await db.one(
        'SELECT checkpointFloor FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;
    const checkpoint = checkpointRow?.checkpointfloor || 0;

    res.json({
        active: false,
        dailyRuns: 0,
        remainingRuns: 99,
        cooldownRemaining: cdRemaining,
        checkpointFloor: checkpoint,
    });
});

// Начать заход
router.post('/dungeon/start', async (req, res) => {
    const userId = req.userId;
    const { skills: equippedSkillIds } = req.body; // [1,2,3,4]

    if (finishingRuns.has(userId)) {
        return res.status(409).json({ error: 'Предыдущий поход завершается перед перезагрузкой' });
    }
    if (activeRuns.has(userId)) {
        return res.status(400).json({ error: 'Данж уже активен' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastRun = await db.one(
        'SELECT dailyRuns, dailyRunDate, startedAt FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;

    // Кулдаун 6ч
    if (lastRun?.startedat) {
        const cd = 30 * 60 - (Math.floor(Date.now() / 1000) - lastRun.startedat);
        if (cd > 0) {
            return res.status(400).json({ error: `Кулдаун: ${Math.floor(cd / 60)}м ${cd % 60}с` });
        }
    }

    // Данные игрока
    const user = await db.one(
        'SELECT id, level, baseS, baseA, baseD, baseM, inventory, equipment, equipment_1, equipment_2, equipment_3, active_equip_slot, drinkuntil, activedrink, roomtype, roomuntil, premiumuntil, guildId FROM users WHERE id = ?',
        [userId]
    ) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (Number(user.level) < 2) {
        return res.status(403).json({ error: 'Вход в подземелье доступен со 2 уровня' });
    }

    const activeSlot = user.active_equip_slot || 1;
    const equipKey = `equipment_${activeSlot}`;
    const parseEq = (v: any) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    let equip = parseEq(user[equipKey]);
    if (!equip || Object.keys(equip).length === 0) equip = parseEq(user.equipment_1);
    if (!equip || Object.keys(equip).length === 0) equip = parseEq(user.equipment);

    const weapon = equip.weapon1;
    const weaponRarity = weapon?.rarity_id ?? 0;

    // Получаем реальные статы персонажа
    const stats = await buildPlayerStats(user, 'pve');
    const playerAntiStats = (await loadBattleAntiStats(userId, user.guildId || user.guildid)).antiStats;
    const playerMaxHp = stats.hp;
    const playerHp = stats.hp; // всегда с полным HP в бой

    // Чекпоинт
    let checkpointRow = await db.one('SELECT checkpointFloor FROM dungeon_runs WHERE userId = ?', [userId]).catch(() => null) as any;
    const checkpoint = checkpointRow?.checkpointfloor || 0;
    const startFloor = req.body.startFloor && req.body.startFloor <= checkpoint ? req.body.startFloor : Math.max(1, checkpoint);

    const skills = await getAvailableSkills(userId, equippedSkillIds || []);

    const enemies = await generateFloorEnemies(startFloor);

    // Логи для анализа баланса
    try {
        await db.run(`INSERT INTO dungeon_logs (userId, floor, playerHp, playerMaxHp, playerStr, playerAgi, playerDef, playerMag, enemies, startedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?)`,
            [userId, startFloor, playerHp, playerMaxHp, stats.s, stats.a, stats.d, stats.m,
             JSON.stringify(enemies.map(e => ({ name: e.name, hp: e.maxHp, dmg: e.dmg, interval: e._attackInterval }))),
             Math.floor(Date.now() / 1000)]
        );
    } catch (e: any) { console.error('[dungeon_logs]', e.message); }

    const now = Date.now() / 1000;
    const run: DungeonRun = {
        userId, currentFloor: startFloor, checkpointFloor: checkpoint,
        playerHp: playerMaxHp, playerMaxHp,
        playerStr: stats.s, playerAgi: stats.a,
        playerDef: stats.d, playerMag: stats.m,
        playerExtra: (stats as any).extra || {}, playerVamp: (stats as any).vampirism || 0,
        playerAntiStats,
        playerLevel: user.level,
        equippedWeaponRarity: weaponRarity,
        equippedWeaponStr: weapon?.bonuses?.s || 0,
        enemies, rage: 0, autoTimer: 0, lastPlayerAttackAt: now, skills,
        buffs: {}, skillCooldowns: {}, log: [],
        startedAt: Math.floor(Date.now() / 1000),
        dailyRuns: 0, dailyRunDate: today,
        tickTimer: null, cleared: false,
        lastHpUpdate: Math.floor(Date.now() / 1000),
        regenRate: getHpRegenRate(user),
        targetIndex: 0,
        accumulatedLoot: { silver: 0, items: [], pages: [] },
    };

    // Запускаем тик-цикл
    run.tickTimer = setInterval(() => tickCombat(run), TICK_MS);

    activeRuns.set(userId, run);

    // Сохраняем в БД
    await db.run(
        `INSERT INTO dungeon_runs (userId, currentFloor, checkpointFloor, enemyData, playerHp, playerMaxHp, role, skills, startedAt, dailyRuns, dailyRunDate)
         VALUES (?, ?, ?, '[]', ?, ?, 'warrior', ?, ?, ?, ?)
         ON CONFLICT (userId) DO UPDATE SET
         currentFloor=?, checkpointFloor=?, enemyData='[]', playerHp=?, playerMaxHp=?, skills=?, startedAt=?, dailyRuns=?, dailyRunDate=?`,
        [userId, startFloor, checkpoint, playerMaxHp, playerMaxHp, JSON.stringify(equippedSkillIds || []), run.startedAt, run.dailyRuns, today,
         startFloor, checkpoint, playerMaxHp, playerMaxHp, JSON.stringify(equippedSkillIds || []), run.startedAt, run.dailyRuns, today]
    );

    res.json({
        success: true,
        floor: startFloor,
        isBoss: enemies.some(e => e.isBoss),
        playerHp: playerMaxHp,
        playerMaxHp,
        enemies: enemies.map(e => ({ id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, isBoss: e.isBoss })),
        rage: 0,
        skills: run.skills,
    });
});

// Состояние боя (polling)
router.get('/dungeon/state', async (req, res) => {
    const userId = req.userId;
    const run = activeRuns.get(userId);
    if (!run) return res.json({ active: false });

    const attackSpeed = getAttackSpeed(run.equippedWeaponRarity, run.equippedWeaponStr);
    const playerAttackProgress = Math.min(1, run.autoTimer / ((1 / attackSpeed) / COMBAT_SPEED));

    // Валидация цели: если мертва или нет — авто-таргет на первого живого
    const target = run.enemies[run.targetIndex];
    if (!target || target.hp <= 0) {
        const aliveIdx = run.enemies.findIndex(e => e.hp > 0);
        run.targetIndex = aliveIdx >= 0 ? aliveIdx : 0;
    }

    const dead = run.playerHp <= 0;
    const combatLog = run.log.splice(0);
    res.json({
        active: true,
        currentFloor: run.currentFloor,
        playerHp: run.playerHp,
        playerMaxHp: run.playerMaxHp,
        enemies: run.enemies.map(e => ({
            id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, isBoss: e.isBoss,
            image: e.image || '',
            lastAttackAt: e._lastAttackTime || run.startedAt,
            attackInterval: (e._attackInterval || 2.5),
            stunned: !!(e.stunTimer && e.stunTimer > 0),
            stunLeft: (e.stunTimer && e.stunTimer > 0) ? e.stunTimer : 0,
            windingUp: e._windupStartedAtMs != null,
            windupRemainingMs: e._windupStartedAtMs != null
                ? Math.max(0, ENEMY_WINDUP_MS - (Date.now() - e._windupStartedAtMs))
                : 0,
        })),
        playerAttackInterval: (1 / attackSpeed) / COMBAT_SPEED,
        lastPlayerAttackAt: run.lastPlayerAttackAt,
        playerAttackProgress,
        attackSpeed: attackSpeed.toFixed(1),
        rage: Math.round(run.rage),
        regenRate: run.regenRate,
        buffs: Object.entries(run.buffs).map(([k, v]) => ({ id: k, endsAt: v.endsAt })),
        skillCooldowns: run.skillCooldowns,
        log: combatLog,
        cleared: run.cleared,
        dead,
        targetIndex: run.targetIndex,
    });
    if (dead) activeRuns.delete(userId);
});

// Использовать скилл
router.post('/dungeon/skill', async (req, res) => {
    const userId = req.userId;
    const { skillId } = req.body;
    const run = activeRuns.get(userId);
    if (!run) return res.status(400).json({ error: 'Данж не активен' });
    if (run.playerHp <= 0) return res.status(400).json({ error: 'Вы мертвы' });

    const skill = run.skills.find(s => s.id === skillId);
    if (!skill) return res.status(400).json({ error: 'Скилл не найден' });

    const now = Date.now() / 1000;

    // Кулдаун
    if (run.skillCooldowns[skillId] && run.skillCooldowns[skillId] > now) {
        return res.status(400).json({ error: `Скилл на кулдауне: ${Math.ceil(run.skillCooldowns[skillId] - now)}с` });
    }

    // Ярость
    if (Math.floor(run.rage) < skill.rageCost) {
        return res.status(400).json({ error: `Недостаточно ярости (${Math.floor(run.rage)}/${skill.rageCost})` });
    }

    run.rage -= skill.rageCost;
    if (skill.cooldown > 0) {
        run.skillCooldowns[skillId] = now + skill.cooldown;
    }

    const lvl = skill.level;
    const { damage: dmg } = calcPlayerDamage(run);

    switch (skill.name) {
        case 'shield_bash': {
            const target = getTarget(run); if (!target) break;
            const bashDmg = Math.floor(dmg * (0.8 + skillBonus(lvl, 0.1)));
            const stun = 1.5 + skillBonus(lvl, 0.2);
            target.hp -= bashDmg;
            target.stunTimer = stun;
            const interrupted = interruptEnemyAttack(target);
            run.log.push(`⚡ Удар щитом: ${bashDmg} урона, оглушение ${stun.toFixed(1)}с`);
            if (interrupted) run.log.push(`🛑 Замах ${target.name} прерван`);
            break;
        }
        case 'sweep': {
            const swDmg = Math.floor(dmg * (0.6 + skillBonus(lvl, 0.1)));
            // Бьём выбранную цель и непосредственно соседние позиции.
            // Мёртвые враги остаются в списке, но урон по ним не проходит.
            const from = Math.max(0, run.targetIndex - 1);
            const to = Math.min(run.enemies.length - 1, run.targetIndex + 1);
            const targets = run.enemies.slice(from, to + 1).filter(e => e.hp > 0);
            for (const enemy of targets) enemy.hp -= swDmg;
            run.log.push(`↔ Размах: ${swDmg} урона по ${targets.length} ${targets.length === 1 ? 'цели' : 'целям'}`);
            break;
        }
        case 'battle_cry': {
            const bonus = 20 + skillBonus(lvl, 5);
            const duration = 12 + skillBonus(lvl, 1);
            run.buffs['battle_cry'] = { endsAt: now + duration, value: bonus };
            run.log.push(`📢 Боевой клич: +${bonus}% урона, +1 ярость/удар на ${duration}с`);
            break;
        }
        case 'rend': {
            const target = getTarget(run); if (!target) break;
            const dotDmg = Math.floor(dmg * (0.2 + skillBonus(lvl, 0.05)));
            run.log.push(`🩸 Раздирание: кровотечение ${dotDmg}×3 за 9с`);
            target.hp -= dotDmg * 3;
            break;
        }
        case 'execute': {
            const target = getTarget(run); if (!target) break;
            if (target.hp > target.maxHp * 0.3) {
                run.rage += skill.rageCost;
                return res.status(400).json({ error: 'Цель должна быть <30% HP' });
            }
            const execDmg = Math.floor(dmg * (2 + skillBonus(lvl, 0.25)));
            target.hp -= execDmg;
            run.log.push(`💀 Добивание: ${execDmg} урона`);
            break;
        }
        case 'demoralize': {
            const target = getTarget(run); if (!target) break;
            if (!target.debuffs) target.debuffs = {};
            const debuffPct = 10 + skillBonus(lvl, 2);
            const debuffDur = 15 + skillBonus(lvl, 2);
            target.debuffs['demoralize'] = { endsAt: now + debuffDur, value: debuffPct };
            run.log.push(`😨 Деморализация: -${debuffPct}% урона врагу на ${debuffDur}с`);
            break;
        }
        case 'charge': {
            const rageGain = skill.rageGain + skillBonus(lvl, 3);
            const stun = 1 + skillBonus(lvl, 0.2);
            run.rage = Math.min(100, run.rage + rageGain);
            const target = getTarget(run);
            if (target) {
                const interrupted = interruptEnemyAttack(target);
                target.stunTimer = stun;
                if (interrupted) run.log.push(`🛑 Замах ${target.name} прерван`);
            }
            run.log.push(`🏃 Рывок: +${rageGain} ярости, оглушение ${stun.toFixed(1)}с`);
            break;
        }
        case 'whirlwind': {
            const wwDmg = Math.floor(dmg * (0.5 + skillBonus(lvl, 0.1)));
            for (const e of run.enemies) e.hp -= wwDmg;
            run.log.push(`🌀 Вихрь: ${wwDmg} урона по всем врагам`);
            break;
        }
    }

    // Проверка смертей врагов
    checkEnemyDeaths(run);

    res.json({
        playerHp: run.playerHp,
        enemies: run.enemies.map(e => ({ id: e.id, name: e.name, hp: Math.max(0, e.hp), maxHp: e.maxHp, isBoss: e.isBoss })),
        rage: Math.round(run.rage),
        buffs: Object.entries(run.buffs).map(([k, v]) => ({ id: k, endsAt: v.endsAt })),
        skillCooldowns: run.skillCooldowns,
        log: run.log.splice(0),
    });
});

// Сменить таргет
router.post('/dungeon/target', async (req, res) => {
    const userId = req.userId;
    const { enemyId } = req.body;
    const run = activeRuns.get(userId);
    if (!run) return res.status(400).json({ error: 'Данж не активен' });

    const idx = run.enemies.findIndex(e => e.id === enemyId);
    if (idx === -1) return res.status(400).json({ error: 'Враг не найден' });
    const enemy = run.enemies[idx];
    if (!enemy) return res.status(400).json({ error: 'Враг не найден' });
    if (enemy.hp <= 0) return res.status(400).json({ error: 'Враг уже мёртв' });

    run.targetIndex = idx;
    res.json({ targetId: enemyId, targetName: enemy.name });
});

// Забрать награду (накапливается, выдаётся при выходе)
router.post('/dungeon/claim', async (req, res) => {
    const userId = req.userId;
    const run = activeRuns.get(userId);
    if (!run) return res.status(400).json({ error: 'Данж не активен' });
    if (run.enemies.some(e => e.hp > 0)) return res.status(400).json({ error: 'Сначала убейте всех врагов' });

    // Награда за этаж (накапливаем, НЕ выдаём сразу)
    const floor = run.currentFloor;
    const silverReward = 10 + floor * 15 + Math.floor(Math.random() * floor * 10);

    // Шанс руны/предмета
    let itemReward: any = null;
    const isBossFloor = floor % 5 === 0;
    const dropChance = isBossFloor ? 0.4 : 0.1 + floor * 0.02;
    if (Math.random() < dropChance) {
        const rarityRoll = Math.random();
        let rarityId = 0;
        if (rarityRoll < 0.5) rarityId = 0;
        else if (rarityRoll < 0.8) rarityId = 1;
        else if (rarityRoll < 0.93) rarityId = 2;
        else if (rarityRoll < 0.98) rarityId = 3;
        else rarityId = 4;

        const craftItem = await db.one(
            'SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ? AND c.type = \'upgrade\' ORDER BY RANDOM() LIMIT 1',
            [rarityId]
        ).catch(() => null) as any;

        if (craftItem) {
            itemReward = { id: craftItem.id, name: craftItem.name, rarity: craftItem.display_name, rarity_id: craftItem.rarity_id, count: 1, image: craftItem.image, type: 'craft_item', itemType: 'upgrade', rarity_color: craftItem.color };
        }
    }

    // Шанс экипировки
    let equipReward: any = null;
    const equipChance = isBossFloor ? 0.3 : 0.1;
    if (Math.random() < equipChance) {
        // Редкость зависит от этажа: выше этаж → выше шанс хорошей редкости
        const maxRarity = Math.min(6, Math.floor(floor / 3)); // этаж 3→1, 6→2, 9→3, ...
        const rarityRoll = Math.random();
        let rarityId = 0;
        if (rarityRoll < 0.4) rarityId = Math.min(maxRarity, 0);
        else if (rarityRoll < 0.7) rarityId = Math.min(maxRarity, 1);
        else if (rarityRoll < 0.85) rarityId = Math.min(maxRarity, 2);
        else if (rarityRoll < 0.94) rarityId = Math.min(maxRarity, 3);
        else if (rarityRoll < 0.98) rarityId = Math.min(maxRarity, 4);
        else rarityId = Math.min(maxRarity, 5);

        const equip = await db.one(
            'SELECT i.*, r.display_name as rarity_display, r.color as rarity_color FROM items i JOIN rarities r ON i.rarity_id = r.id WHERE i.rarity_id = $1 ORDER BY RANDOM() LIMIT 1',
            [rarityId]
        ).catch(() => null) as any;

        if (equip) {
            equipReward = { id: Date.now(), name: equip.name, slot: equip.slot, rarity_id: equip.rarity_id, rarity_display: equip.rarity_display, rarity_color: equip.rarity_color, bonuses: JSON.parse(equip.bonuses || '{}'), extra: JSON.parse(equip.extra || '{}'), image: equip.image };
        }
    }

    // Шанс страницы скилла
    let pageReward: any = null;
    const pageChance = isBossFloor ? 0.3 : 0.03;
    if (Math.random() < pageChance) {
        const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        if (randomSkill) {
            pageReward = { skillId: randomSkill.id, name: randomSkill.nameRu };
        }
    }

    // Накапливаем лут
    run.accumulatedLoot.silver += silverReward;
    if (itemReward) run.accumulatedLoot.items.push(itemReward);
    if (equipReward) run.accumulatedLoot.items.push(equipReward);
    if (pageReward) run.accumulatedLoot.pages.push(pageReward);

    // Чекпоинт на этажах-боссах — сохраняем следующий этаж
    if (isBossFloor && floor > run.checkpointFloor) {
        run.checkpointFloor = floor + 1;
        await db.run('UPDATE dungeon_runs SET checkpointFloor = ? WHERE userId = ?', [floor + 1, userId]);
    }

    // НЕ останавливаем тик — игрок остаётся в комнате, регенит HP
    // Сохраняем состояние для продолжения/выхода
    await db.run(
        `UPDATE dungeon_runs SET currentFloor = ?, playerHp = ?, playerMaxHp = ?, checkpointFloor = ? WHERE userId = ?`,
        [floor + 1, run.playerHp, run.playerMaxHp, run.checkpointFloor, userId]
    );

    res.json({
        success: true,
        floor: floor,
        nextFloor: floor + 1,
        silver: silverReward,
        item: itemReward,
        equip: equipReward,
        page: pageReward,
        playerHp: run.playerHp,
        checkpoint: run.checkpointFloor,
        isBoss: isBossFloor,
    });
});

// Продолжить на следующий этаж
router.post('/dungeon/continue', async (req, res) => {
    const userId = req.userId;
    if (finishingRuns.has(userId)) return res.status(409).json({ error: 'Поход завершается перед перезагрузкой' });
    const { skills: equippedSkillIds } = req.body;

    const saved = await db.one(
        'SELECT currentFloor, playerHp, playerMaxHp, checkpointFloor FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;
    if (!saved) return res.status(400).json({ error: 'Нет сохранённого захода' });

    const user = await db.one(
        'SELECT id, level, baseS, baseA, baseD, baseM, inventory, equipment, equipment_1, equipment_2, equipment_3, active_equip_slot, drinkuntil, activedrink, roomtype, roomuntil, premiumuntil, guildId FROM users WHERE id = ?',
        [userId]
    ) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeSlot = user.active_equip_slot || 1;
    const equipKey = `equipment_${activeSlot}`;
    const parseEq = (v: any) => typeof v === 'string' ? JSON.parse(v || '{}') : (v && typeof v === 'object' ? v : {});
    let equip = parseEq(user[equipKey]);
    if (!equip || Object.keys(equip).length === 0) equip = parseEq(user.equipment_1);
    if (!equip || Object.keys(equip).length === 0) equip = parseEq(user.equipment);
    const weaponRarity = equip.weapon1?.rarity_id ?? 0;

    const stats = await buildPlayerStats(user, 'pve');
    const playerAntiStats = (await loadBattleAntiStats(userId, user.guildId || user.guildid)).antiStats;

    const skills = await getAvailableSkills(userId, equippedSkillIds || []);
    const floor = saved.currentfloor;
    const enemies = await generateFloorEnemies(floor);

    const now = Date.now() / 1000;
    const existingRun = activeRuns.get(userId);
    const savedRage = existingRun?.rage ?? 0;
    if (existingRun?.tickTimer) clearInterval(existingRun.tickTimer); // остановим старый тик

    const run: DungeonRun = {
        userId, currentFloor: floor, checkpointFloor: saved.checkpointfloor,
        playerHp: saved.playerhp, playerMaxHp: saved.playermaxhp,
        playerStr: stats.s, playerAgi: stats.a,
        playerDef: stats.d, playerMag: stats.m,
        playerExtra: (stats as any).extra || {}, playerVamp: (stats as any).vampirism || 0,
        playerAntiStats,
        playerLevel: user.level,
        equippedWeaponRarity: weaponRarity,
        equippedWeaponStr: equip.weapon1?.bonuses?.s || 0,
        enemies, rage: savedRage, autoTimer: 0, lastPlayerAttackAt: now, skills,
        buffs: {}, skillCooldowns: {}, log: [],
        startedAt: Math.floor(Date.now() / 1000),
        dailyRuns: 0, dailyRunDate: '',
        tickTimer: null, cleared: false,
        lastHpUpdate: Math.floor(Date.now() / 1000),
        regenRate: getHpRegenRate(user),
        targetIndex: existingRun?.targetIndex ?? 0,
        accumulatedLoot: existingRun?.accumulatedLoot || { silver: 0, items: [], pages: [] },
    };

    run.tickTimer = setInterval(() => tickCombat(run), TICK_MS);
    activeRuns.set(userId, run);

    res.json({
        success: true,
        floor,
        isBoss: enemies.some(e => e.isBoss),
        playerHp: run.playerHp,
        playerMaxHp: run.playerMaxHp,
        enemies: enemies.map(e => ({ id: e.id, name: e.name, hp: e.hp, maxHp: e.maxHp, isBoss: e.isBoss })),
        rage: 0,
        skills: run.skills,
    });
});

// Сбежать (потеря лута) или Выйти (получить накопленный лут)
router.post('/dungeon/flee', async (req, res) => {
    const userId = req.userId;
    if (finishingRuns.has(userId)) return res.status(409).json({ error: 'Поход уже завершается перед перезагрузкой' });
    const run = activeRuns.get(userId);
    if (!run) return res.status(400).json({ error: 'Данж не активен' });

    const loot = run.accumulatedLoot || { silver: 0, items: [], pages: [] };
    finishingRuns.add(userId);
    if (run.tickTimer) clearInterval(run.tickTimer);
    activeRuns.delete(userId);
    try {
        await payDungeonLoot(createPgDungeonPayoutRepository(), {
            userId,
            loot,
            currentFloor: run.currentFloor,
            startedAt: Math.floor(Date.now() / 1000),
        });
        res.json({ success: true, loot });
    } catch (error) {
        restartDungeonRunAfterFailedPayout(run, () => setInterval(() => tickCombat(run), TICK_MS));
        activeRuns.set(userId, run);
        throw error;
    } finally {
        finishingRuns.delete(userId);
    }
});

// Список всех умений
router.get('/dungeon/skills', async (_req, res) => {
    res.json({ skills: SKILLS });
});

// Страницы скиллов игрока
router.get('/dungeon/pages', async (req, res) => {
    const userId = req.userId;
    const pages = await db.query(
        'SELECT skillId, count FROM skill_pages WHERE userId = ? ORDER BY skillId',
        [userId]
    ) as any[];
    const levels = await db.query(
        'SELECT skillId, level FROM skill_levels WHERE userId = ?',
        [userId]
    ) as any[];

    const countMap: Record<number, number> = {};
    for (const p of pages) countMap[p.skillid] = p.count;
    const levelMap: Record<number, number> = {};
    for (const r of levels) levelMap[r.skillid] = r.level;

    // Возвращаем ВСЕ скиллы — базовые уже имеют уровень 1
    const allPages = SKILLS.map(s => ({
        skillId: s.id,
        count: countMap[s.id] || 0,
        name: s.nameRu,
        level: Math.max(BASE_SKILL_IDS.has(s.id) ? 1 : 0, levelMap[s.id] || 0),
        needForNext: 10 + (Math.max(BASE_SKILL_IDS.has(s.id) ? 1 : 0, levelMap[s.id] || 0)) * 15,
    }));

    res.json({ pages: allPages });
});

// Улучшить скилл (страницы + серебро, растёт с уровнем)
router.post('/dungeon/upgrade-skill', async (req, res) => {
    const userId = req.userId;
    const { skillId } = req.body;

    const curLevel = await db.one(
        'SELECT level FROM skill_levels WHERE userId = ? AND skillId = ?',
        [userId, skillId]
    ).catch(() => null) as any;
    const level = curLevel?.level || 0;

    const neededPages = 10 + level * 15;
    const neededSilver = 1000 * Math.pow(3, level);

    const pages = await db.one(
        'SELECT count FROM skill_pages WHERE userId = ? AND skillId = ?',
        [userId, skillId]
    ).catch(() => null) as any;

    if (!pages || pages.count < neededPages) {
        return res.status(400).json({ error: `Нужно ${neededPages} страниц (есть ${pages?.count || 0})` });
    }

    const user = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;
    if (!user || user.money < neededSilver) {
        return res.status(400).json({ error: `Нужно ${neededSilver.toLocaleString()} серебра` });
    }

    await db.run('UPDATE users SET money = money - ? WHERE id = ?', [neededSilver, userId]);
    await db.run(
        'UPDATE skill_pages SET count = count - ? WHERE userId = ? AND skillId = ?',
        [neededPages, userId, skillId]
    );

    await db.run(
        'INSERT INTO skill_levels (userId, skillId, level) VALUES (?, ?, 1) ON CONFLICT (userId, skillId) DO UPDATE SET level = skill_levels.level + 1',
        [userId, skillId]
    );

    const updated = await db.one(
        'SELECT level FROM skill_levels WHERE userId = ? AND skillId = ?',
        [userId, skillId]
    ) as any;

    res.json({ success: true, skillId, newLevel: updated.level });
});

// ═══════ ТИК БОЯ ═══════

function tickCombat(run: DungeonRun) {
    if (run.playerHp <= 0) {
        run.playerHp = 0;
        run.cleared = false;
        if (run.tickTimer) clearInterval(run.tickTimer);
        // Сохраняем смерть в БД — кулдаун 6 часов
        db.run('UPDATE dungeon_runs SET currentFloor = ?, startedAt = ? WHERE userId = ?',
            [run.currentFloor, Math.floor(Date.now() / 1000), run.userId]).catch(() => {});
        return;
    }
    const now = Date.now() / 1000;
    const attackSpeed = getAttackSpeed(run.equippedWeaponRarity, run.equippedWeaponStr);

    // Статы игрока для формул боя
    const playerStats = { s: run.playerStr, a: run.playerAgi, d: run.playerDef, m: run.playerMag, hp: run.playerMaxHp, extra: {} as any, bonuses: {} as any } as any;

    // Пассивный спад ярости (вне боя ярость уходит быстрее)
    const enemiesAlive = run.enemies.some(e => e.hp > 0);
    if (!enemiesAlive) {
        run.rage = Math.max(0, run.rage - (TICK_MS / 1000) * 5 * COMBAT_SPEED); // 5/сек вне боя
        // Ускоренный реген HP в комнате отдыха (~5% от максимума в сек с бонусами)
        const regenPerSec = run.playerMaxHp * 0.03 * run.regenRate;
        const regenThisTick = Math.floor(regenPerSec * (TICK_MS / 1000));
        if (regenThisTick > 0 && run.playerHp < run.playerMaxHp) {
            run.playerHp = Math.min(run.playerMaxHp, run.playerHp + regenThisTick);
        }
    } else {
        run.rage = Math.max(0, run.rage - (TICK_MS / 1000) * 0.5 * COMBAT_SPEED); // 0.5/сек в бою
    }

    // Автоатака игрока — одна атака за тик
    run.autoTimer += (TICK_MS / 1000); // реальное время
    const attackInterval = (1 / attackSpeed) / COMBAT_SPEED; // реальные секунды
    if (run.autoTimer >= attackInterval) {
        run.autoTimer -= attackInterval;
        run.lastPlayerAttackAt = Date.now() / 1000;
        const target = getTarget(run);
        if (target && target.hp > 0) {
            const { damage: dmg, isCrit, dodged, blocked, vampHeal } = calcPlayerDamage(run);
            target.hp -= dmg;
            if (vampHeal > 0) { run.playerHp = Math.min(run.playerMaxHp, run.playerHp + vampHeal); run.log.push(`🩸 Вампиризм +${vampHeal} HP`); }
            if (!dodged) run.rage = Math.min(100, run.rage + 5 + (run.buffs['battle_cry'] ? 2 : 0));
            run.log.push(blocked ? (isCrit ? `💥 Крит ${dmg} по ${target.name} (блок)` : `⚔️ ${dmg} по ${target.name} (блок)`) : (isCrit ? `💥 Крит ${dmg} по ${target.name}` : `⚔️ ${dmg} по ${target.name}`));
        }
    }

    // Автоатака врагов — одна атака за тик, прогресс доходит до 100%
    for (const enemy of run.enemies) {
        if (enemy.hp <= 0) continue;
        if (enemy.stunTimer && enemy.stunTimer > 0) {
            enemy.stunTimer -= (TICK_MS / 1000); // реальное время, не COMBAT_SPEED
            // Когда оглушение только что закончилось — сбрасываем таймер атаки на полный интервал
            if (enemy.stunTimer <= 0) {
                enemy['_lastAttack'] = 0;
                enemy._windupStartedAtMs = null;
                enemy._lastAttackTime = Date.now() / 1000;
            }
            continue;
        }
        const interval = enemy._attackInterval || 2.5;
        if (!enemy['_lastAttack']) enemy['_lastAttack'] = 0;
        if (enemy._windupStartedAtMs == null) enemy['_lastAttack'] += (TICK_MS / 1000); // реальное время
        const attackState = advanceEnemyAttack({
            attackElapsedMs: enemy['_lastAttack'] * 1000,
            attackIntervalMs: interval * 1000,
            windupStartedAtMs: enemy._windupStartedAtMs ?? null,
        }, Date.now());
        const startedWindup = enemy._windupStartedAtMs == null && attackState.state.windupStartedAtMs != null;
        enemy['_lastAttack'] = attackState.state.attackElapsedMs / 1000;
        enemy._windupStartedAtMs = attackState.state.windupStartedAtMs;
        if (startedWindup) run.log.push(`⚠ ${enemy.name} готовит удар`);
        if (attackState.shouldAttack) {
            enemy._lastAttackTime = Date.now() / 1000;
            const result = calcEnemyDamage(enemy, playerStats, run.currentFloor);
            const reduced = result.damage;
            run.playerHp -= reduced;
            run.rage = Math.min(100, run.rage + 3);
            if (result.dodged) run.log.push(`↗ Вы уклоняетесь от ${enemy.name}`);
            else if (result.blocked) run.log.push(`🛡 Блок! ${enemy.name} бьёт на ${reduced}`);
            else run.log.push(`👊 ${enemy.name} бьёт на ${reduced}`);
        }
    }

    // Просроченные баффы
    for (const [key, val] of Object.entries(run.buffs)) {
        if (val.endsAt < now) delete run.buffs[key];
    }
    for (const enemy of run.enemies) {
        if (enemy.debuffs) {
            for (const [key, val] of Object.entries(enemy.debuffs)) {
                if (val.endsAt < now) delete enemy.debuffs[key];
            }
        }
    }

    checkEnemyDeaths(run);

    // Смерть игрока
    if (run.playerHp <= 0) {
        run.playerHp = 0;
        if (run.tickTimer) clearInterval(run.tickTimer);
        db.run('UPDATE dungeon_runs SET startedAt = $1, maxfloor = GREATEST(maxfloor, $2) WHERE userId = $3', [Math.floor(Date.now() / 1000), run.currentFloor, run.userId]);
    }
}

function checkEnemyDeaths(run: DungeonRun) {
    // Мёртвых не удаляем — оставляем в списке (серый портрет на клиенте)
    const allDead = run.enemies.every(e => e.hp <= 0);
    if (allDead) {
        run.cleared = true;
        // НЕ останавливаем тик — нужен для регена в комнате отдыха
    }
    // Если цель мертва — авто-таргет на первого живого
    const target = getTarget(run);
    if (target && target.hp <= 0) {
        const aliveIdx = run.enemies.findIndex(e => e.hp > 0);
        if (aliveIdx >= 0) run.targetIndex = aliveIdx;
    }
}

// Рейтинг данжа
router.get('/dungeon/leaderboard', async (_req, res) => {
    const topFloor = await db.raw(
        `SELECT u.id as userId, u.username, u.level, g.id as guildid, g.name as guildName, dr.maxfloor FROM dungeon_runs dr JOIN users u ON dr.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id ORDER BY dr.maxfloor DESC LIMIT 5`
    ).catch(() => ({ rows: [] })) as any;
    const topReward = await db.raw(
        `SELECT u.id as userId, u.username, u.level, g.id as guildid, g.name as guildName, dr.maxreward FROM dungeon_runs dr JOIN users u ON dr.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id ORDER BY dr.maxreward DESC LIMIT 5`
    ).catch(() => ({ rows: [] })) as any;

    res.json({
        topFloor: topFloor.rows || [],
        topReward: topReward.rows || [],
    });
});

export default router;
