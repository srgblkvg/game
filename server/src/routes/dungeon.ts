import { Router } from 'express';
import { db } from '../db/index';
import { buildPlayerStats, getBaseStats } from '../db/helpers';

const router = Router();

// ═══════ ТАБЛИЦЫ ═══════

db.run(`CREATE TABLE IF NOT EXISTS dungeon_runs (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL UNIQUE,
    currentFloor INTEGER DEFAULT 1,
    checkpointFloor INTEGER DEFAULT 0,
    enemyData TEXT NOT NULL DEFAULT '[]',
    playerHp INTEGER NOT NULL,
    playerMaxHp INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'warrior',
    skills TEXT NOT NULL DEFAULT '[]',
    startedAt INTEGER NOT NULL,
    dailyRuns INTEGER DEFAULT 0,
    dailyRunDate TEXT DEFAULT ''
)`).catch(() => {});

db.run(`CREATE TABLE IF NOT EXISTS skill_pages (
    id SERIAL PRIMARY KEY,
    userId INTEGER NOT NULL,
    skillId INTEGER NOT NULL,
    count INTEGER DEFAULT 1,
    UNIQUE(userId, skillId)
)`).catch(() => {});

db.run(`CREATE TABLE IF NOT EXISTS skill_levels (
    userId INTEGER NOT NULL,
    skillId INTEGER NOT NULL,
    level INTEGER DEFAULT 0,
    UNIQUE(userId, skillId)
)`).catch(() => {});

// ═══════ КОНСТАНТЫ ═══════

const WEAPON_SPEED: Record<number, number> = { 0: 0.3, 1: 0.5, 2: 0.7, 3: 0.9, 4: 1.1, 5: 1.3, 6: 1.5 };
const TICK_MS = 100;
const DAILY_RUNS_MAX = 4;
const BASE_SKILL_IDS = new Set([7, 2, 3]); // Рывок, Размах, Боевой клич

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
}

interface Skill {
    id: number; name: string; nameRu: string; rageCost: number; rageGain: number; cooldown: number;
    desc: string; descScale: string; icon: string;
}

const SKILLS: Skill[] = [
    { id: 1, name: 'shield_bash', nameRu: 'Удар щитом', rageCost: 5, rageGain: 0, cooldown: 6,
      icon: '🛡️', desc: 'Оглушение', descScale: '+0.2с стана, +10% урона' },
    { id: 2, name: 'sweep', nameRu: 'Размах', rageCost: 15, rageGain: 0, cooldown: 5,
      icon: '⚔️', desc: 'AoE 3 цели', descScale: '+10% урона' },
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
}

const activeRuns = new Map<number, DungeonRun>();

function getAttackSpeed(rarity: number, weaponStrBonus: number): number {
    const base = WEAPON_SPEED[rarity] ?? 0.5;
    // Замедление от силы оружия (небольшое: +20 силы ≈ -10% скорости)
    return Math.max(0.3, base / (1 + weaponStrBonus * 0.005));
}

function calcPlayerDamage(run: DungeonRun): { damage: number; isCrit: boolean } {
    // Урон: делим scaled stat на 5 для баланса
    const rs = run.playerStr / 5;
    const ra = run.playerAgi / 5;
    const rm = run.playerMag / 5;
    const weaponBonus = 3 + run.equippedWeaponRarity * 3;
    const baseDmg = rs + ra * 0.3 + rm * 0.2 + run.playerLevel + weaponBonus;
    const dmgBonus = (run.buffs['battle_cry'] ? (1 + (run.buffs['battle_cry'].value / 100)) : 1.0);
    const dmg = Math.floor((baseDmg + Math.random() * (run.playerLevel + weaponBonus)) * dmgBonus);

    // Крит: сырая ловкость × 0.5% шанс (используем /4 как для урона)
    const critChance = ra * 0.5;
    const isCrit = Math.random() * 100 < critChance;

    return { damage: isCrit ? Math.floor(dmg * 2) : dmg, isCrit };
}

function calcEnemyDamage(enemy: EnemyData, floor: number): number {
    const base = enemy.dmg + Math.floor(floor * 1.5);
    const debuffPct = enemy.debuffs?.['demoralize']?.value || 0;
    const debuff = 1 - debuffPct / 100;
    return Math.floor((base + Math.random() * 6) * debuff);
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
    const interval = isBoss ? 0.5 + Math.random() * 1.0 : 0.5 + Math.random() * 2.0; // 0.5-1.5с босс, 0.5-2.5с обычный
    return { id, name: mob.name, hp, maxHp: hp, dmg, isBoss, image: mob.background || '', _attackInterval: interval, _lastAttackTime: Math.floor(Date.now() / 1000) };
}

async function generateFloorEnemies(floor: number): Promise<EnemyData[]> {
    const isBoss = floor % 5 === 0;
    const mobs = await loadMobs();
    const enemies: EnemyData[] = [];

    if (isBoss) {
        // Босс — берём случайного моба с усилением
        const mob = mobs[Math.floor(Math.random() * mobs.length)];
        enemies.push(generateEnemyFromMob(mob, floor, true));
    } else {
        const count = 2 + Math.floor(Math.random() * 3); // 2-4 моба
        const shuffled = [...mobs].sort(() => Math.random() - 0.5);
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

    const today = new Date().toISOString().slice(0, 10);
    const lastRun = await db.one(
        'SELECT dailyRuns, dailyRunDate, startedAt FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;

    const dailyRuns = (lastRun && lastRun.dailyrundate === today) ? lastRun.dailyruns : 0;
    const remainingRuns = Math.max(0, DAILY_RUNS_MAX - dailyRuns);

    // Кулдаун 6 часов с последнего захода
    const cdRemaining = lastRun?.startedat
        ? Math.max(0, 6 * 3600 - (Math.floor(Date.now() / 1000) - lastRun.startedat))
        : 0;

    // Чекпоинт — с какого этажа можно начать
    const checkpointRow = await db.one(
        'SELECT checkpointFloor FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;
    const checkpoint = checkpointRow?.checkpointfloor || 0;

    res.json({
        active: false,
        dailyRuns,
        remainingRuns,
        cooldownRemaining: cdRemaining,
        checkpointFloor: checkpoint,
    });
});

// Начать заход
router.post('/dungeon/start', async (req, res) => {
    const userId = req.userId;
    const { skills: equippedSkillIds } = req.body; // [1,2,3,4]

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
        const cd = 6 * 3600 - (Math.floor(Date.now() / 1000) - lastRun.startedat);
        if (cd > 0) {
            return res.status(400).json({ error: `Кулдаун: ${Math.floor(cd / 3600)}ч ${Math.floor((cd % 3600) / 60)}м` });
        }
    }

    // Лимит попыток
    const dailyRuns = (lastRun && lastRun.dailyrundate === today) ? lastRun.dailyruns : 0;
    if (dailyRuns >= DAILY_RUNS_MAX) {
        return res.status(400).json({ error: 'Лимит попыток на сегодня (4)' });
    }

    // Данные игрока
    const user = await db.one(
        'SELECT id, level, baseS, baseA, baseD, baseM, inventory, equipment, equipment_1, equipment_2, equipment_3, active_equip_slot, drinkuntil, activedrink, roomtype, roomuntil, premiumuntil FROM users WHERE id = ?',
        [userId]
    ) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

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
        playerLevel: user.level,
        equippedWeaponRarity: weaponRarity,
        equippedWeaponStr: weapon?.bonuses?.s || 0,
        enemies, rage: 0, autoTimer: 0, lastPlayerAttackAt: now, skills,
        buffs: {}, skillCooldowns: {}, log: [],
        startedAt: Math.floor(Date.now() / 1000),
        dailyRuns: dailyRuns + 1, dailyRunDate: today,
        tickTimer: null, cleared: false,
        lastHpUpdate: Math.floor(Date.now() / 1000),
        regenRate: getHpRegenRate(user),
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
    const playerAttackProgress = Math.min(1, run.autoTimer / (1 / attackSpeed));

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
        })),
        playerAttackInterval: (1 / attackSpeed),
        lastPlayerAttackAt: run.lastPlayerAttackAt,
        playerAttackProgress,
        attackSpeed: attackSpeed.toFixed(1),
        rage: run.rage,
        buffs: Object.entries(run.buffs).map(([k, v]) => ({ id: k, endsAt: v.endsAt })),
        skillCooldowns: run.skillCooldowns,
        log: run.log.splice(0),
        cleared: run.cleared,
        dead: run.playerHp <= 0,
    });
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
    if (run.rage < skill.rageCost) {
        return res.status(400).json({ error: `Недостаточно ярости (${run.rage}/${skill.rageCost})` });
    }

    run.rage -= skill.rageCost;
    if (skill.cooldown > 0) {
        run.skillCooldowns[skillId] = now + skill.cooldown;
    }

    const lvl = skill.level;
    const { damage: dmg } = calcPlayerDamage(run);

    switch (skill.name) {
        case 'shield_bash': {
            const target = run.enemies[0]; if (!target) break;
            const bashDmg = Math.floor(dmg * (0.8 + skillBonus(lvl, 0.1)));
            const stun = 1.5 + skillBonus(lvl, 0.2);
            target.hp -= bashDmg;
            target.stunTimer = stun;
            run.log.push(`⚡ Удар щитом: ${bashDmg} урона, оглушение ${stun.toFixed(1)}с`);
            break;
        }
        case 'sweep': {
            const swDmg = Math.floor(dmg * (0.6 + skillBonus(lvl, 0.1)));
            const count = Math.min(3, run.enemies.length);
            for (let i = 0; i < count; i++) {
                const e = run.enemies[i];
                if (e) e.hp -= swDmg;
            }
            run.log.push(`↔ Размах: ${swDmg} урона по ${count} целям`);
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
            const target = run.enemies[0]; if (!target) break;
            const dotDmg = Math.floor(dmg * (0.2 + skillBonus(lvl, 0.05)));
            run.log.push(`🩸 Раздирание: кровотечение ${dotDmg}×3 за 9с`);
            target.hp -= dotDmg * 3;
            break;
        }
        case 'execute': {
            const target = run.enemies[0]; if (!target) break;
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
            const target = run.enemies[0]; if (!target) break;
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
            if (run.enemies[0]) run.enemies[0].stunTimer = stun;
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
        rage: run.rage,
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

    // Перемещаем выбранного врага на первую позицию
    const [target] = run.enemies.splice(idx, 1);
    if (!target) return res.status(400).json({ error: 'Враг не найден' });
    run.enemies.unshift(target);

    res.json({ targetId: target.id, targetName: target.name });
});

// Забрать награду и выйти (между этажами)
router.post('/dungeon/claim', async (req, res) => {
    const userId = req.userId;
    const run = activeRuns.get(userId);
    if (!run) return res.status(400).json({ error: 'Данж не активен' });
    if (run.enemies.length > 0) return res.status(400).json({ error: 'Сначала убейте всех врагов' });

    // Награда за этаж
    const floor = run.currentFloor;
    const silverReward = 10 + floor * 15 + Math.floor(Math.random() * floor * 10);

    await db.run('UPDATE users SET money = money + ? WHERE id = ?', [silverReward, userId]);

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
            itemReward = { name: craftItem.name, rarity: craftItem.display_name, image: craftItem.image };
            const inventory = JSON.parse((await db.one('SELECT inventory FROM users WHERE id = ?', [userId]) as any).inventory || '[]');
            const existing = inventory.find((i: any) => i.type === 'craft_item' && i.id === craftItem.id);
            if (existing) {
                existing.count = (existing.count || 0) + 1;
            } else {
                inventory.push({
                    type: 'craft_item', id: craftItem.id, name: craftItem.name,
                    rarity_id: craftItem.rarity_id, rarity_display: craftItem.display_name,
                    rarity_color: craftItem.color, count: 1, itemType: 'upgrade', image: craftItem.image,
                });
            }
            await db.run('UPDATE users SET inventory = ? WHERE id = ?', [JSON.stringify(inventory), userId]);
        }
    }

    // Шанс страницы скилла
    let pageReward: any = null;
    const pageChance = isBossFloor ? 0.3 : 0.03;
    if (Math.random() < pageChance) {
        const randomSkill = SKILLS[Math.floor(Math.random() * SKILLS.length)];
        if (!randomSkill) return;
        await db.run(
            'INSERT INTO skill_pages (userId, skillId, count) VALUES (?, ?, 1) ON CONFLICT (userId, skillId) DO UPDATE SET count = skill_pages.count + 1',
            [userId, randomSkill.id]
        );
        pageReward = { skillId: randomSkill.id, name: randomSkill.nameRu };
    }

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
        page: pageReward,
        playerHp: run.playerHp,
        checkpoint: run.checkpointFloor,
        isBoss: isBossFloor,
    });
});

// Продолжить на следующий этаж
router.post('/dungeon/continue', async (req, res) => {
    const userId = req.userId;
    const { skills: equippedSkillIds } = req.body;

    const saved = await db.one(
        'SELECT currentFloor, playerHp, playerMaxHp, checkpointFloor FROM dungeon_runs WHERE userId = ?',
        [userId]
    ).catch(() => null) as any;
    if (!saved) return res.status(400).json({ error: 'Нет сохранённого захода' });

    const user = await db.one(
        'SELECT id, level, baseS, baseA, baseD, baseM, inventory, equipment, equipment_1, equipment_2, equipment_3, active_equip_slot, drinkuntil, activedrink, roomtype, roomuntil, premiumuntil FROM users WHERE id = ?',
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

// Сбежать (потеря лута)
router.post('/dungeon/flee', async (req, res) => {
    const userId = req.userId;
    const run = activeRuns.get(userId);
    if (!run) return res.status(400).json({ error: 'Данж не активен' });

    if (run.tickTimer) clearInterval(run.tickTimer);
    activeRuns.delete(userId);

    await db.run('DELETE FROM dungeon_runs WHERE userId = ?', [userId]);
    res.json({ success: true, message: 'Вы сбежали из данжа' });
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
    if (run.playerHp <= 0) return;
    const now = Date.now() / 1000;
    const attackSpeed = getAttackSpeed(run.equippedWeaponRarity, run.equippedWeaponStr);

    // Пассивный спад ярости (вне боя ярость уходит быстрее)
    const enemiesAlive = run.enemies.some(e => e.hp > 0);
    if (!enemiesAlive) {
        run.rage = Math.max(0, run.rage - (TICK_MS / 1000) * 5); // 5/сек вне боя
        // Пассивный реген HP по формуле игры: rate HP за 5 секунд
        const nowSec = Math.floor(Date.now() / 1000);
        const elapsed = nowSec - (run.lastHpUpdate || nowSec);
        if (elapsed > 0 && run.playerHp < run.playerMaxHp) {
            const regen = Math.floor(elapsed * run.regenRate / 5);
            run.playerHp = Math.min(run.playerMaxHp, run.playerHp + regen);
            run.lastHpUpdate = nowSec;
        }
    } else {
        run.rage = Math.max(0, run.rage - (TICK_MS / 1000) * 0.5); // 0.5/сек в бою
    }

    // Автоатака игрока — одна атака за тик
    run.autoTimer += TICK_MS / 1000;
    const attackInterval = 1 / attackSpeed;
    if (run.autoTimer >= attackInterval) {
        run.autoTimer -= attackInterval;
        run.lastPlayerAttackAt = Date.now() / 1000;
        const target = run.enemies[0];
        if (target && target.hp > 0) {
            const { damage: dmg, isCrit } = calcPlayerDamage(run);
            target.hp -= dmg;
            run.rage = Math.min(100, run.rage + 5 + (run.buffs['battle_cry'] ? 2 : 0));
            run.log.push(isCrit ? `💥 Крит ${dmg} по ${target.name}` : `⚔️ ${dmg} по ${target.name}`);
        }
    }

    // Автоатака врагов — одна атака за тик, прогресс доходит до 100%
    for (const enemy of run.enemies) {
        if (enemy.hp <= 0) continue;
        if (enemy.stunTimer && enemy.stunTimer > 0) {
            enemy.stunTimer -= TICK_MS / 1000;
            continue;
        }
        const interval = enemy._attackInterval || 2.5;
        if (!enemy['_lastAttack']) enemy['_lastAttack'] = 0;
        enemy['_lastAttack'] += TICK_MS / 1000;
        if (enemy['_lastAttack'] >= interval) {
            enemy['_lastAttack'] -= interval;
            enemy._lastAttackTime = Date.now() / 1000;
            const dmg = calcEnemyDamage(enemy, run.currentFloor);
            // Минимальная защита (0.1% за очко — почти без блокирования)
            const reduced = Math.max(1, Math.floor(dmg * (1 - run.playerDef * 0.0008)));
            run.playerHp -= reduced;
            run.rage = Math.min(100, run.rage + 3); // ярость от получения урона
            run.log.push(`👊 ${enemy.name} бьёт на ${reduced}`);
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
        db.run('DELETE FROM dungeon_runs WHERE userId = ?', [run.userId]);
    }
}

function checkEnemyDeaths(run: DungeonRun) {
    // Удаляем мёртвых
    const alive = run.enemies.filter(e => e.hp > 0);
    if (alive.length < run.enemies.length) {
        run.enemies = alive;
        // Авто-таргет на врага с наименьшим HP
        if (run.enemies.length > 0) {
            run.enemies.sort((a, b) => a.hp - b.hp);
        } else {
            run.cleared = true;
            if (run.tickTimer) clearInterval(run.tickTimer);
        }
    }
}

export default router;
