"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TALENT_DESCS = exports.TALENT_LABELS = exports.TALENT_TYPES = exports.BOSS_RESPAWN_DELAY = exports.BOSS_COOLDOWN = exports.BOSS_LEVEL_PER_KILL = exports.BOSS_STAT_SCALE = exports.BOSS_HP_PER_KILL = exports.BOSS_BASE_LEVEL = exports.BOSS_BASE_STATS = exports.BOSS_BASE_HP = void 0;
exports.flattenBossEffects = flattenBossEffects;
exports.getTalentUpgradeCost = getTalentUpgradeCost;
exports.getBossStats = getBossStats;
exports.getOrCreateBoss = getOrCreateBoss;
exports.damageBoss = damageBoss;
exports.getGuildTalents = getGuildTalents;
exports.getPlayerTalents = getPlayerTalents;
exports.getTalentAntiBonus = getTalentAntiBonus;
exports.getAntiStats = getAntiStats;
const index_1 = require("../db/index");
// ── Константы босса ──
exports.BOSS_BASE_HP = 100000;
exports.BOSS_BASE_STATS = { s: 80, a: 50, d: 60, m: 50 };
exports.BOSS_BASE_LEVEL = 20;
exports.BOSS_HP_PER_KILL = 50000;
exports.BOSS_STAT_SCALE = 0.10; // +10% статов за убийство
exports.BOSS_LEVEL_PER_KILL = 5;
exports.BOSS_COOLDOWN = 3600; // 1 час
exports.BOSS_RESPAWN_DELAY = 300; // 5 минут
const BOSS_EFFECT_POOL = [
    { name: 'Сверх-уклонение', baseValue: 30, effect: {} }, // extra.dodge
    { name: 'Сверх-блок', baseValue: 30, effect: {} }, // extra.fullBlock
    { name: 'Вампиризм', baseValue: 10, effect: {} }, // vampirism
    { name: 'Ядовитость', baseValue: 3, effect: {} }, // poisonOnHit
    { name: 'Контратака', baseValue: 20, effect: {} }, // counterOnHit
    { name: 'Ярость', baseValue: 20, effect: {} }, // rageDmg
    { name: 'Пробивание блока', baseValue: 15, effect: {} }, // blockPen
    { name: 'Удача', baseValue: 5, effect: {} }, // luckBoost
    { name: 'Стойкость', baseValue: 20, effect: {} }, // resiliencePct
    { name: 'Сокрушительный удар', baseValue: 25, effect: {} }, // extra.crit
    { name: 'Всегда первый', baseValue: 0, effect: {} }, // alwaysFirst (бинарный)
    { name: 'Добивание', baseValue: 0, effect: {} }, // execute (бинарный)
];
const MAX_BOSS_EFFECTS = 6;
/** Построить объект эффекта с учётом скейлинга от killCount */
function buildEffectScaled(eff, killCount) {
    // alwaysFirst и execute — бинарные, не скейлятся
    if (eff.name === 'Всегда первый')
        return { alwaysFirst: true };
    if (eff.name === 'Добивание')
        return { execute: true };
    const scaled = Math.round(eff.baseValue * (1 + exports.BOSS_STAT_SCALE * killCount));
    switch (eff.name) {
        case 'Сверх-уклонение': return { extra: { dodge: scaled } };
        case 'Сверх-блок': return { extra: { fullBlock: scaled } };
        case 'Сокрушительный удар': return { extra: { crit: scaled } };
        default: {
            const keyMap = {
                'Вампиризм': 'vampirism', 'Ядовитость': 'poisonOnHit',
                'Контратака': 'counterOnHit', 'Ярость': 'rageDmg',
                'Пробивание блока': 'blockPen', 'Удача': 'luckBoost',
                'Стойкость': 'resiliencePct',
            };
            const prop = keyMap[eff.name];
            const result = {};
            result[prop] = scaled;
            return result;
        }
    }
}
function pickBossEffects(killCount) {
    if (killCount <= 0)
        return [];
    const count = Math.min(killCount, MAX_BOSS_EFFECTS);
    const shuffled = [...BOSS_EFFECT_POOL].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(e => ({
        name: e.name,
        effect: buildEffectScaled(e, killCount),
    }));
}
/** Сжать эффекты босса в плоский объект для Object.assign в бою */
function flattenBossEffects(effects) {
    const result = { extra: {} };
    for (const e of effects) {
        for (const [key, val] of Object.entries(e.effect)) {
            if (key === 'extra' && typeof val === 'object') {
                Object.assign(result.extra, val);
            }
            else {
                result[key] = val;
            }
        }
    }
    if (Object.keys(result.extra).length === 0)
        delete result.extra;
    return result;
}
// ── Деревья талантов ──
exports.TALENT_TYPES = ['accuracy', 'fortitude', 'penetration', 'control', 'vampiric'];
exports.TALENT_LABELS = {
    accuracy: 'Меткость',
    fortitude: 'Стойкость',
    penetration: 'Пробивание',
    control: 'Контроль',
    vampiric: 'Антивампиризм',
};
exports.TALENT_DESCS = {
    accuracy: '−1% вражеского уклонения за уровень',
    fortitude: '−1% вражеского крита за уровень',
    penetration: '−1% вражеского блока за уровень',
    control: '−1% вражеской контратаки за уровень',
    vampiric: '−1% вражеского вампиризма за уровень',
};
// Эффект одного уровня таланта на вражеский экстра-стат (проценты)
const TALENT_EFFECT_PER_LEVEL = 1;
/** Стоимость прокачки таланта: 10 * 2^currentLevel */
function getTalentUpgradeCost(currentLevel) {
    return 10 * Math.pow(2, currentLevel);
}
function scaleStat(base, killCount) {
    return Math.round(base * (1 + exports.BOSS_STAT_SCALE * killCount));
}
function getBossStats(killCount) {
    return {
        s: scaleStat(exports.BOSS_BASE_STATS.s, killCount),
        a: scaleStat(exports.BOSS_BASE_STATS.a, killCount),
        d: scaleStat(exports.BOSS_BASE_STATS.d, killCount),
        m: scaleStat(exports.BOSS_BASE_STATS.m, killCount),
        hp: exports.BOSS_BASE_HP + exports.BOSS_HP_PER_KILL * killCount,
        level: exports.BOSS_BASE_LEVEL + exports.BOSS_LEVEL_PER_KILL * killCount,
        killCount,
    };
}
async function getOrCreateBoss(guildId) {
    const now = Math.floor(Date.now() / 1000);
    let boss = await index_1.db.one('SELECT * FROM guild_bosses WHERE guildId = ?', [guildId]).catch(() => null);
    if (!boss) {
        const stats = getBossStats(0);
        const effects = pickBossEffects(0);
        await index_1.db.run('INSERT INTO guild_bosses (guildId, killCount, currentHp, maxHp, atk, agi, def, mst, level, effects, respawnAt) VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 0)', [guildId, stats.hp, stats.hp, stats.s, stats.a, stats.d, stats.m, stats.level, JSON.stringify(effects)]);
        boss = { guildId, killcount: 0, currenthp: stats.hp, maxhp: stats.hp, atk: stats.s, agi: stats.a, def: stats.d, mst: stats.m, level: stats.level, effects: JSON.stringify(effects), respawnat: 0 };
    }
    // Авто-респаун если прошло 5 минут
    if (boss.respawnat > 0 && now >= boss.respawnat) {
        const stats = getBossStats(boss.killcount);
        const newEffects = pickBossEffects(boss.killcount);
        await index_1.db.run('UPDATE guild_bosses SET currentHp = ?, maxHp = ?, atk = ?, agi = ?, def = ?, mst = ?, level = ?, effects = ?, respawnAt = 0 WHERE guildId = ?', [stats.hp, stats.hp, stats.s, stats.a, stats.d, stats.m, stats.level, JSON.stringify(newEffects), guildId]);
        boss = { guildId, killcount: boss.killcount, currenthp: stats.hp, maxhp: stats.hp, atk: stats.s, agi: stats.a, def: stats.d, mst: stats.m, level: stats.level, effects: JSON.stringify(newEffects), respawnat: 0 };
        // WS: оповещаем всех о новом боссе
        Promise.resolve().then(() => __importStar(require('../events'))).then(m => m.sendToGuild(guildId, {
            type: 'guild_boss_update',
            message: `⚡ Кровавый исполин вернулся! Уровень ${stats.level}, HP ${stats.hp.toLocaleString()}.`,
            data: { bossHp: stats.hp, bossMaxHp: stats.hp, bossKilled: false, respawnAt: 0, newKillCount: boss.killcount },
        })).catch(() => { });
    }
    let parsedEffects = [];
    try {
        parsedEffects = typeof boss.effects === 'string' ? JSON.parse(boss.effects) : (boss.effects || []);
    }
    catch { }
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
        respawnAt: boss.respawnat || 0,
    };
}
async function damageBoss(guildId, damage) {
    const boss = await index_1.db.one('SELECT * FROM guild_bosses WHERE guildId = ?', [guildId]);
    const newHp = Math.max(0, boss.currenthp - damage);
    const killed = newHp <= 0;
    if (killed) {
        const newKillCount = boss.killcount + 1;
        const respawnAt = Math.floor(Date.now() / 1000) + exports.BOSS_RESPAWN_DELAY;
        // Ставим таймер респауна, HP=0, killCount уже обновлён
        await index_1.db.run('UPDATE guild_bosses SET killCount = ?, currentHp = 0, respawnAt = ? WHERE guildId = ?', [newKillCount, respawnAt, guildId]);
        return { killed: true, newKillCount, respawnAt };
    }
    else {
        await index_1.db.run('UPDATE guild_bosses SET currentHp = ? WHERE guildId = ?', [newHp, guildId]);
        return { killed: false, newKillCount: boss.killcount };
    }
}
// ── Таланты ──
async function getGuildTalents(guildId) {
    const rows = await index_1.db.query('SELECT talentType, level, progress FROM guild_talents WHERE guildId = ?', [guildId]);
    const talents = {};
    for (const t of exports.TALENT_TYPES)
        talents[t] = { level: 0, progress: 0 };
    for (const r of rows)
        talents[r.talenttype] = { level: r.level || 0, progress: r.progress || 0 };
    return talents;
}
async function getPlayerTalents(userId, guildId) {
    const rows = await index_1.db.query('SELECT talentType, level, progress FROM player_guild_talents WHERE userId = ? AND guildId = ?', [userId, guildId]);
    const talents = {};
    for (const t of exports.TALENT_TYPES)
        talents[t] = { level: 0, progress: 0 };
    for (const r of rows)
        talents[r.talenttype] = { level: r.level || 0, progress: r.progress || 0 };
    return talents;
}
/** Суммарный контр-бонус от личных + гильдийских талантов */
function getTalentAntiBonus(playerTalents, guildTalents, talentType) {
    return ((playerTalents[talentType]?.level || 0) + (guildTalents[talentType]?.level || 0)) * TALENT_EFFECT_PER_LEVEL;
}
/** Получить все поля anti-* для передачи в TurnContext */
function getAntiStats(playerTalents, guildTalents) {
    return {
        antiDodge: getTalentAntiBonus(playerTalents, guildTalents, 'accuracy'),
        antiCrit: getTalentAntiBonus(playerTalents, guildTalents, 'fortitude'),
        antiBlock: getTalentAntiBonus(playerTalents, guildTalents, 'penetration'),
        antiCounter: getTalentAntiBonus(playerTalents, guildTalents, 'control'),
        antiVampiric: getTalentAntiBonus(playerTalents, guildTalents, 'vampiric'),
    };
}
//# sourceMappingURL=guildBoss.js.map