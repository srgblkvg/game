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
const express_1 = require("express");
const index_1 = require("../db/index");
const helpers_1 = require("../db/helpers");
const battle_1 = require("../game/battle");
const stats_1 = require("../game/stats");
const events_1 = require("../events");
const guild_1 = require("./guild");
const guildBoss_1 = require("../game/guildBoss");
const router = (0, express_1.Router)();
console.log('[guildBoss] Router loaded, routes registered');
// ── Отладка: жив ли роут ──
router.get('/guild/boss/ping', (_req, res) => { console.log('[guildBoss] PING!'); res.json({ ok: true, time: Date.now() }); });
// ── GET /guild/boss — информация о боссе, кулдаун игрока, таланты ──
router.get('/guild/boss', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user?.guildid)
        return res.status(400).json({ error: 'Не в гильдии' });
    const now = Math.floor(Date.now() / 1000);
    const member = await index_1.db.one('SELECT * FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
    if (!member)
        return res.status(400).json({ error: 'Не в гильдии' });
    const boss = await (0, guildBoss_1.getOrCreateBoss)(user.guildid);
    const cooldownRemaining = Math.max(0, guildBoss_1.BOSS_COOLDOWN - (now - (member.lastbossattackat || 0)));
    const playerTalents = await (0, guildBoss_1.getPlayerTalents)(userId, user.guildid);
    const guildTalents = await (0, guildBoss_1.getGuildTalents)(user.guildid);
    // Очки гильдии
    const guild = await index_1.db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]);
    res.json({
        boss: {
            ...boss,
            name: `Гильдейский босс`,
        },
        cooldownRemaining,
        canAttack: cooldownRemaining <= 0,
        playerTalents,
        guildTalents,
        playerPoints: member.talentpoints || 0,
        guildPoints: guild.talentpoints || 0,
        talentInfo: guildBoss_1.TALENT_TYPES.map(t => ({
            type: t,
            label: guildBoss_1.TALENT_LABELS[t],
            desc: guildBoss_1.TALENT_DESCS[t],
            playerLevel: playerTalents[t]?.level || 0,
            playerProgress: playerTalents[t]?.progress || 0,
            guildLevel: guildTalents[t]?.level || 0,
            guildProgress: guildTalents[t]?.progress || 0,
            playerUpgradeCost: (0, guildBoss_1.getTalentUpgradeCost)(playerTalents[t]?.level || 0),
            guildUpgradeCost: (0, guildBoss_1.getTalentUpgradeCost)(guildTalents[t]?.level || 0),
        })),
    });
});
// ── POST /guild/boss/attack — атака босса ──
router.post('/guild/boss/attack', async (req, res) => {
    const userId = req.userId;
    const now = Math.floor(Date.now() / 1000);
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user?.guildid)
        return res.status(400).json({ error: 'Не в гильдии' });
    const member = await index_1.db.one('SELECT * FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
    if (!member)
        return res.status(400).json({ error: 'Не в гильдии' });
    // Кулдаун
    const cooldownRemaining = Math.max(0, guildBoss_1.BOSS_COOLDOWN - (now - (member.lastbossattackat || 0)));
    if (cooldownRemaining > 0) {
        return res.status(400).json({
            error: `До следующей атаки ${Math.floor(cooldownRemaining / 60)} мин ${cooldownRemaining % 60} сек`,
        });
    }
    // Получаем/создаём босса
    const boss = await (0, guildBoss_1.getOrCreateBoss)(user.guildid);
    // Статы игрока с PvE-бонусами гильдии (scout_hq)
    const userStats = await (0, helpers_1.buildPlayerStats)(user, 'pve');
    // Бонус фракции Стражник
    if (user.faction === 'guard') {
        const mult = 1.10;
        userStats.s = Math.round(userStats.s * mult);
        userStats.a = Math.round(userStats.a * mult);
        userStats.d = Math.round(userStats.d * mult);
        userStats.m = Math.round(userStats.m * mult);
        userStats.hp = Math.round(userStats.hp * mult);
    }
    // Таланты и контр-статы
    const playerTalents = await (0, guildBoss_1.getPlayerTalents)(userId, user.guildid);
    const guildTalents = await (0, guildBoss_1.getGuildTalents)(user.guildid);
    const antiStats = (0, guildBoss_1.getAntiStats)(playerTalents, guildTalents);
    // Статы босса
    const bossBase = { s: boss.atk, a: boss.agi, d: boss.def, m: boss.mst };
    const bossStats = (0, stats_1.currentStats)(bossBase, {});
    bossStats.hp = boss.maxHp;
    // Применяем эффекты босса (вампиризм, яд, уклонение и т.д.)
    if (boss.effects && boss.effects.length > 0) {
        const flatFx = (0, guildBoss_1.flattenBossEffects)(boss.effects);
        Object.assign(bossStats, flatFx);
    }
    // Босс бой всегда с максимальным HP (как на турнирах)
    let userHp = userStats.hp;
    let bossCurrentHp = boss.currentHp;
    const steps = [];
    const addStep = (s) => steps.push(s);
    addStep({
        type: 'attack', actor: 'attacker',
        message: `⚔ ${user.username} vs Гильдейский босс`,
        hp1: userHp, hp2: bossCurrentHp, maxHp1: userStats.hp, maxHp2: boss.maxHp,
        stats1: { name: user.username, level: user.level, S: userStats.s, A: userStats.a, D: userStats.d, M: userStats.m, HP: userHp },
        stats2: { name: 'Гильдейский босс', level: boss.level, S: boss.atk, A: boss.agi, D: boss.def, M: boss.mst, HP: boss.maxHp },
    });
    let playerWon = false;
    let stunnedUser = false;
    let stunnedBoss = false;
    for (let turn = 0; turn < 50 && userHp > 0 && bossCurrentHp > 0; turn++) {
        // Ход игрока
        if (stunnedUser) {
            addStep({ type: 'stun', actor: 'attacker', message: `${user.username} оглушён и пропускает ход` });
            stunnedUser = false;
        }
        else {
            const ctx1 = {
                actorName: user.username, targetName: 'Гильдейский босс',
                actorStats: userStats, targetStats: bossStats,
                actorLevel: user.level,
                hpActor: userHp, hpTarget: bossCurrentHp,
                maxHpActor: userStats.hp, maxHpTarget: boss.maxHp,
                actor: 'attacker', target: 'defender',
                antiDodge: antiStats.antiDodge,
                antiCrit: antiStats.antiCrit,
                antiBlock: antiStats.antiBlock,
                antiCounter: antiStats.antiCounter,
            };
            const result1 = (0, battle_1.runTurn)(ctx1, addStep);
            userHp = result1.hpActor;
            bossCurrentHp = result1.hpTarget;
            stunnedBoss = result1.stunnedTarget;
        }
        if (bossCurrentHp <= 0) {
            playerWon = true;
            break;
        }
        // Ход босса
        if (stunnedBoss) {
            addStep({ type: 'stun', actor: 'defender', message: `Гильдейский босс оглушён и пропускает ход` });
            stunnedBoss = false;
        }
        else {
            const ctx2 = {
                actorName: 'Гильдейский босс', targetName: user.username,
                actorStats: bossStats, targetStats: userStats,
                actorLevel: boss.level,
                hpActor: bossCurrentHp, hpTarget: userHp,
                maxHpActor: boss.maxHp, maxHpTarget: userStats.hp,
                actor: 'defender', target: 'attacker',
                // Игрок снижает вампиризм босса через targetAntiVampiric
                targetAntiVampiric: antiStats.antiVampiric,
            };
            const result2 = (0, battle_1.runTurn)(ctx2, addStep);
            bossCurrentHp = result2.hpActor;
            userHp = result2.hpTarget;
            stunnedUser = result2.stunnedTarget;
        }
        if (userHp <= 0)
            break;
        if (bossCurrentHp <= 0) {
            playerWon = true;
            break;
        }
    }
    if (playerWon) {
        addStep({ type: 'end', message: `${user.username} победил босса!` });
    }
    else {
        addStep({ type: 'end', message: `Гильдейский босс победил!` });
    }
    // Нанесённый урон боссу
    const damageDealt = boss.currentHp - Math.max(0, bossCurrentHp);
    // Сохраняем урон боссу
    const { killed, newKillCount, respawnAt } = await (0, guildBoss_1.damageBoss)(user.guildid, damageDealt);
    // Обновляем кулдаун игрока
    await index_1.db.run('UPDATE guild_members SET lastBossAttackAt = ? WHERE userId = ? AND guildId = ?', [now, userId, user.guildid]);
    // +1 личное очко талантов за атаку
    await index_1.db.run('UPDATE guild_members SET talentPoints = talentPoints + 1 WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
    // +1 гильдийское очко за убийство
    let guildTalentAwarded = false;
    if (killed) {
        await index_1.db.run('UPDATE guilds SET talentPoints = talentPoints + 1 WHERE id = ?', [user.guildid]);
        guildTalentAwarded = true;
    }
    // WS: обновление HP босса для всех членов гильдии
    const { sendToGuild, sendToUser: sendToUserEvent } = await Promise.resolve().then(() => __importStar(require('../events')));
    const updatedBoss = await (0, guildBoss_1.getOrCreateBoss)(user.guildid);
    const updatedGuild = await index_1.db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]);
    console.log(`[guildBoss] Sending WS update to guild ${user.guildid}: HP=${updatedBoss.currentHp}/${updatedBoss.maxHp}`);
    sendToGuild(user.guildid, {
        type: 'guild_boss_update',
        message: killed
            ? `${user.username} добил Кровавого исполина! Новый появится через 5 минут.`
            : `${user.username} нанёс ${damageDealt.toLocaleString()} урона Кровавому исполину`,
        data: {
            attackerId: userId,
            attackerName: user.username,
            damageDealt,
            bossHp: updatedBoss.currentHp,
            bossMaxHp: updatedBoss.maxHp,
            bossKilled: killed,
            respawnAt: respawnAt || updatedBoss.respawnAt,
            newKillCount: killed ? newKillCount : boss.killCount,
            guildTalentPoints: updatedGuild?.talentpoints || 0,
            ratingsChanged: true,
            newBoss: null,
        },
    });
    // Персональный кулдаун атакующему — чтобы правая панель обновилась сразу
    const remainingCd = Math.max(0, guildBoss_1.BOSS_COOLDOWN - (now - (member.lastbossattackat || 0)));
    sendToUserEvent(userId, {
        type: 'guild_boss_update',
        data: {
            cooldownRemaining: remainingCd,
            bossHp: updatedBoss.currentHp,
            bossMaxHp: updatedBoss.maxHp,
        },
    });
    // Уведомление в чат гильдии о результате
    if (killed) {
        sendToGuild(user.guildid, {
            type: 'guild_boss_kill',
            message: `🏆 ${user.username} добил гильдейского босса! Новый босс (уровень ${guildBoss_1.BOSS_BASE_LEVEL + newKillCount * guildBoss_1.BOSS_LEVEL_PER_KILL}) пробудился. +1 очко гильдийских талантов.`,
            data: { userId, username: user.username, newKillCount },
        });
    }
    // Гильд-квест PvE
    if (playerWon) {
        (0, guild_1.updateGuildQuestProgress)(user.guildid, 'pve').catch(e => console.error('guildQuest boss PvE:', e.message));
        (0, events_1.markDirty)(userId, 'quests');
    }
    // Новый босс (если убит)
    const newBossData = killed ? await (0, guildBoss_1.getOrCreateBoss)(user.guildid) : null;
    // Сохраняем лог боя в историю
    await index_1.db.run(`INSERT INTO guild_boss_battles (guildId, userId, username, damageDealt, bossHpBefore, bossHpAfter, playerWon, bossKilled, steps, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [user.guildid, userId, user.username, damageDealt, boss.currentHp, Math.max(0, bossCurrentHp), playerWon, killed, JSON.stringify(steps), now]).catch(e => console.error('guildBoss save log:', e.message));
    res.json({
        steps,
        playerWon,
        damageDealt,
        bossKilled: killed,
        guildTalentAwarded,
        respawnAt: respawnAt || 0,
        newKillCount: killed ? newKillCount : boss.killCount,
        currentHp: user.currentHp,
        hpAfter: user.currentHp,
        bossHpAfter: Math.max(0, bossCurrentHp),
        personalPointsGained: 1,
        guildPointsGained: killed ? 1 : 0,
    });
});
// ── GET /guild/boss/battles — история боёв с боссом ──
router.get('/guild/boss/battles', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user?.guildid)
        return res.status(400).json({ error: 'Не в гильдии' });
    const userIdFilter = req.query.userId ? parseInt(req.query.userId) : 0;
    let rows;
    if (userIdFilter > 0) {
        rows = await index_1.db.query('SELECT id, userId, username, damageDealt, bossHpBefore, bossHpAfter, playerWon, bossKilled, steps, createdAt FROM guild_boss_battles WHERE guildId = ? AND userId = ? ORDER BY createdAt DESC LIMIT 20', [user.guildid, userIdFilter]);
    }
    else {
        rows = await index_1.db.query('SELECT id, userId, username, damageDealt, bossHpBefore, bossHpAfter, playerWon, bossKilled, steps, createdAt FROM guild_boss_battles WHERE guildId = ? ORDER BY createdAt DESC LIMIT 50', [user.guildid]);
    }
    res.json({
        battles: rows.map(r => ({
            id: r.id,
            userId: r.userid,
            username: r.username,
            damageDealt: r.damagedealt,
            bossHpBefore: r.bosshpbefore,
            bossHpAfter: r.bosshpafter,
            playerWon: r.playerwon,
            bossKilled: r.bosskilled,
            steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps,
            createdAt: r.createdat,
        })),
    });
});
// ── GET /guild/boss/ratings — 4 рейтинга ──
router.get('/guild/boss/ratings', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user?.guildid)
        return res.status(400).json({ error: 'Не в гильдии' });
    const guildId = user.guildid;
    // 1. Топ-5 гильдии по урону
    const guildTop = await index_1.db.query('SELECT b.userId, b.username, u.level, g.name as guildName, SUM(b.damageDealt) as total FROM guild_boss_battles b JOIN users u ON b.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id WHERE b.guildId = ? GROUP BY b.userId, b.username, u.level, g.name ORDER BY total DESC LIMIT 5', [guildId]);
    // 2. Топ-5 игроков по общему урону + место игрока
    const personalTop = await index_1.db.query('SELECT b.userId, b.username, u.level, g.name as guildName, SUM(b.damageDealt) as total FROM guild_boss_battles b JOIN users u ON b.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id GROUP BY b.userId, b.username, u.level, g.name ORDER BY total DESC LIMIT 5');
    const personalRank = await index_1.db.one(`SELECT rank, total FROM (
      SELECT userId, SUM(damageDealt) as total, RANK() OVER (ORDER BY SUM(damageDealt) DESC) as rank
      FROM guild_boss_battles GROUP BY userId
    ) sub WHERE userId = ?`, [userId]).catch(() => null);
    // 3. Топ-5 гильдий по общему урону + место гильдии
    const guildTopList = await index_1.db.query('SELECT g.id, g.name, SUM(b.damageDealt) as total FROM guild_boss_battles b JOIN guilds g ON b.guildId = g.id GROUP BY g.id, g.name ORDER BY total DESC LIMIT 5');
    const guildRank = await index_1.db.one(`SELECT rank, total FROM (
      SELECT guildId, SUM(damageDealt) as total, RANK() OVER (ORDER BY SUM(damageDealt) DESC) as rank
      FROM guild_boss_battles GROUP BY guildId
    ) sub WHERE guildId = ?`, [guildId]).catch(() => null);
    // 4. Топ-5 сильнейших одиночных ударов (из steps)
    const allBattles = await index_1.db.query('SELECT b.userId, b.username, u.level, g.name as guildName, b.steps FROM guild_boss_battles b JOIN users u ON b.userId = u.id LEFT JOIN guilds g ON u.guildId = g.id');
    const playerMaxHit = {};
    for (const row of allBattles) {
        const steps = typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps || []);
        let maxHit = 0;
        for (const s of steps) {
            if (s.type === 'damage' && s.damage > maxHit)
                maxHit = s.damage;
        }
        const uid = row.userid;
        if (!playerMaxHit[uid] || maxHit > playerMaxHit[uid].maxHit) {
            playerMaxHit[uid] = { userId: uid, username: row.username, level: row.level, guildName: row.guildname, maxHit };
        }
    }
    const topHits = Object.values(playerMaxHit)
        .sort((a, b) => b.maxHit - a.maxHit)
        .slice(0, 5);
    // 5. Топ-5 гильдий по убийствам боссов
    const topGuildKills = await index_1.db.query('SELECT g.id, g.name, gb.killCount FROM guilds g JOIN guild_bosses gb ON g.id = gb.guildId ORDER BY gb.killCount DESC LIMIT 5');
    res.json({
        guildTop: guildTop.map(r => ({ userId: r.userid, username: r.username, level: r.level, guildName: r.guildname, total: r.total })),
        personalRank: personalRank ? { rank: personalRank.rank, total: personalRank.total } : null,
        personalTop: personalTop.map(r => ({ userId: r.userid, username: r.username, level: r.level, guildName: r.guildname, total: r.total })),
        guildRank: guildRank ? { rank: guildRank.rank, total: guildRank.total } : null,
        guildTopList: guildTopList.map(r => ({ id: r.id, name: r.name, total: r.total })),
        topHits: topHits.map(r => ({ userId: r.userId, username: r.username, level: r.level, guildName: r.guildName, maxDmg: r.maxHit })),
        topGuildKills: topGuildKills.map(r => ({ id: r.id, name: r.name, kills: r.killcount })),
    });
});
// ── GET /guild/talents — все таланты + очки ──
router.get('/guild/talents', async (req, res) => {
    const userId = req.userId;
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user?.guildid)
        return res.status(400).json({ error: 'Не в гильдии' });
    const member = await index_1.db.one('SELECT talentPoints FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
    const guild = await index_1.db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]);
    const playerTalents = await (0, guildBoss_1.getPlayerTalents)(userId, user.guildid);
    const guildTalents = await (0, guildBoss_1.getGuildTalents)(user.guildid);
    res.json({
        playerPoints: member?.talentpoints || 0,
        guildPoints: guild?.talentpoints || 0,
        talents: guildBoss_1.TALENT_TYPES.map(t => ({
            type: t,
            label: guildBoss_1.TALENT_LABELS[t],
            desc: guildBoss_1.TALENT_DESCS[t],
            playerLevel: playerTalents[t]?.level || 0,
            playerProgress: playerTalents[t]?.progress || 0,
            guildLevel: guildTalents[t]?.level || 0,
            guildProgress: guildTalents[t]?.progress || 0,
            playerUpgradeCost: (0, guildBoss_1.getTalentUpgradeCost)(playerTalents[t]?.level || 0),
            guildUpgradeCost: (0, guildBoss_1.getTalentUpgradeCost)(guildTalents[t]?.level || 0),
        })),
    });
});
// ── POST /guild/talents/upgrade — прокачка таланта ──
router.post('/guild/talents/upgrade', async (req, res) => {
    const userId = req.userId;
    const { talentType, scope } = req.body;
    if (!guildBoss_1.TALENT_TYPES.includes(talentType)) {
        return res.status(400).json({ error: 'Неизвестный тип таланта' });
    }
    if (!['personal', 'guild'].includes(scope)) {
        return res.status(400).json({ error: 'scope должен быть personal или guild' });
    }
    const user = await index_1.db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null);
    if (!user?.guildid)
        return res.status(400).json({ error: 'Не в гильдии' });
    if (scope === 'personal') {
        const member = await index_1.db.one('SELECT talentPoints FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
        if (!member || (member.talentpoints || 0) < 1) {
            return res.status(400).json({ error: 'Нет очков талантов' });
        }
        const row = await index_1.db.one('SELECT level, progress FROM player_guild_talents WHERE userId = ? AND guildId = ? AND talentType = ?', [userId, user.guildid, talentType]).catch(() => null);
        const currentLevel = row?.level || 0;
        const currentProgress = row?.progress || 0;
        const cost = (0, guildBoss_1.getTalentUpgradeCost)(currentLevel);
        // Вкладываем 1 очко
        const newProgress = currentProgress + 1;
        let newLevel = currentLevel;
        let leveledUp = false;
        if (newProgress >= cost) {
            newLevel = currentLevel + 1;
            leveledUp = true;
            if (row) {
                await index_1.db.run('UPDATE player_guild_talents SET level = ?, progress = 0 WHERE userId = ? AND guildId = ? AND talentType = ?', [newLevel, userId, user.guildid, talentType]);
            }
            else {
                await index_1.db.run('INSERT INTO player_guild_talents (userId, guildId, talentType, level, progress) VALUES (?, ?, ?, 1, 0) ON CONFLICT DO NOTHING', [userId, user.guildid, talentType]);
            }
        }
        else {
            if (row) {
                await index_1.db.run('UPDATE player_guild_talents SET progress = ? WHERE userId = ? AND guildId = ? AND talentType = ?', [newProgress, userId, user.guildid, talentType]);
            }
            else {
                await index_1.db.run('INSERT INTO player_guild_talents (userId, guildId, talentType, level, progress) VALUES (?, ?, ?, 0, ?) ON CONFLICT DO NOTHING', [userId, user.guildid, talentType, newProgress]);
            }
        }
        await index_1.db.run('UPDATE guild_members SET talentPoints = talentPoints - 1 WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
        const talents = await (0, guildBoss_1.getPlayerTalents)(userId, user.guildid);
        const updated = await index_1.db.one('SELECT talentPoints FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
        return res.json({
            success: true,
            scope: 'personal',
            talentType,
            newLevel,
            newProgress: leveledUp ? 0 : newProgress,
            cost,
            leveledUp,
            remainingPoints: updated.talentpoints,
        });
    }
    // Гильдийский талант — только лидер
    if (scope === 'guild') {
        const member = await index_1.db.one('SELECT rank FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]);
        if (!member || member.rank !== 'leader') {
            return res.status(403).json({ error: 'Только лидер гильдии может вкладывать гильдийские очки' });
        }
        const guild = await index_1.db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]);
        if (!guild || (guild.talentpoints || 0) < 1) {
            return res.status(400).json({ error: 'Нет гильдийских очков' });
        }
        const row = await index_1.db.one('SELECT level, progress FROM guild_talents WHERE guildId = ? AND talentType = ?', [user.guildid, talentType]).catch(() => null);
        const currentLevel = row?.level || 0;
        const currentProgress = row?.progress || 0;
        const cost = (0, guildBoss_1.getTalentUpgradeCost)(currentLevel);
        const newProgress = currentProgress + 1;
        let newLevel = currentLevel;
        let leveledUp = false;
        if (newProgress >= cost) {
            newLevel = currentLevel + 1;
            leveledUp = true;
            if (row) {
                await index_1.db.run('UPDATE guild_talents SET level = ?, progress = 0 WHERE guildId = ? AND talentType = ?', [newLevel, user.guildid, talentType]);
            }
            else {
                await index_1.db.run('INSERT INTO guild_talents (guildId, talentType, level, progress) VALUES (?, ?, 1, 0) ON CONFLICT DO NOTHING', [user.guildid, talentType]);
            }
        }
        else {
            if (row) {
                await index_1.db.run('UPDATE guild_talents SET progress = ? WHERE guildId = ? AND talentType = ?', [newProgress, user.guildid, talentType]);
            }
            else {
                await index_1.db.run('INSERT INTO guild_talents (guildId, talentType, level, progress) VALUES (?, ?, 0, ?) ON CONFLICT DO NOTHING', [user.guildid, talentType, newProgress]);
            }
        }
        await index_1.db.run('UPDATE guilds SET talentPoints = talentPoints - 1 WHERE id = ?', [user.guildid]);
        const talents = await (0, guildBoss_1.getGuildTalents)(user.guildid);
        const updated = await index_1.db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]);
        return res.json({
            success: true,
            scope: 'guild',
            talentType,
            newLevel,
            newProgress: leveledUp ? 0 : newProgress,
            cost,
            leveledUp,
            remainingPoints: updated.talentpoints,
        });
    }
});
exports.default = router;
//# sourceMappingURL=guildBoss.js.map