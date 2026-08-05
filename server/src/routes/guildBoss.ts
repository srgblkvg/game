import { Router } from 'express';
import { db } from '../db/index';
import { buildPlayerStats } from '../db/helpers';
import { applyHpRegen } from '../game/hpRegen';
import { runTurn, TurnContext, BattleStep } from '../game/battle';
import { currentStats } from '../game/stats';
import { markDirty } from '../events';
import { updateGuildQuestProgress } from './guild';
import {
  BOSS_COOLDOWN, BOSS_BASE_LEVEL, BOSS_LEVEL_PER_KILL, TALENT_TYPES, TALENT_LABELS, TALENT_DESCS,
  getOrCreateBoss, damageBoss, flattenBossEffects, getTalentUpgradeCost,
  getGuildTalents, getPlayerTalents, getAntiStats,
} from '../game/guildBoss';
import type { TalentType } from '../game/guildBoss';

const router = Router();
console.log('[guildBoss] Router loaded, routes registered');

// ── Отладка: жив ли роут ──
router.get('/guild/boss/ping', (_req, res) => { console.log('[guildBoss] PING!'); res.json({ ok: true, time: Date.now() }); });

// ── GET /guild/boss — информация о боссе, кулдаун игрока, таланты ──
router.get('/guild/boss', async (req, res) => {
  const userId = req.userId;
  const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null) as any;
  if (!user?.guildid) return res.status(400).json({ error: 'Не в гильдии' });

  const now = Math.floor(Date.now() / 1000);
  const member = await db.one('SELECT * FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;
  if (!member) return res.status(400).json({ error: 'Не в гильдии' });

  const boss = await getOrCreateBoss(user.guildid);
  const cooldownRemaining = Math.max(0, BOSS_COOLDOWN - (now - (member.lastbossattackat || 0)));

  const playerTalents = await getPlayerTalents(userId, user.guildid);
  const guildTalents = await getGuildTalents(user.guildid);

  // Очки гильдии
  const guild = await db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]) as any;

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
    talentInfo: TALENT_TYPES.map(t => ({
      type: t,
      label: TALENT_LABELS[t],
      desc: TALENT_DESCS[t],
      playerLevel: playerTalents[t],
      guildLevel: guildTalents[t],
      playerUpgradeCost: getTalentUpgradeCost(playerTalents[t] || 0),
      guildUpgradeCost: getTalentUpgradeCost(guildTalents[t] || 0),
    })),
  });
});

// ── POST /guild/boss/attack — атака босса ──
router.post('/guild/boss/attack', async (req, res) => {
  const userId = req.userId;
  const now = Math.floor(Date.now() / 1000);

  const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null) as any;
  if (!user?.guildid) return res.status(400).json({ error: 'Не в гильдии' });

  const member = await db.one('SELECT * FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;
  if (!member) return res.status(400).json({ error: 'Не в гильдии' });

  // Кулдаун
  const cooldownRemaining = Math.max(0, BOSS_COOLDOWN - (now - (member.lastbossattackat || 0)));
  if (cooldownRemaining > 0) {
    return res.status(400).json({
      error: `До следующей атаки ${Math.floor(cooldownRemaining / 60)} мин ${cooldownRemaining % 60} сек`,
    });
  }

  // Получаем/создаём босса
  const boss = await getOrCreateBoss(user.guildid);

  // Статы игрока с PvE-бонусами гильдии (scout_hq)
  const userStats = await buildPlayerStats(user, 'pve');
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
  const playerTalents = await getPlayerTalents(userId, user.guildid);
  const guildTalents = await getGuildTalents(user.guildid);
  const antiStats = getAntiStats(playerTalents, guildTalents);

  // Статы босса
  const bossBase = { s: boss.atk, a: boss.agi, d: boss.def, m: boss.mst };
  const bossStats = currentStats(bossBase, {});
  bossStats.hp = boss.maxHp;
  // Применяем эффекты босса (вампиризм, яд, уклонение и т.д.)
  if (boss.effects && boss.effects.length > 0) {
    const flatFx = flattenBossEffects(boss.effects);
    Object.assign(bossStats, flatFx);
  }

  // Регенерация HP игрока перед боем
  const regeneratedHp = await applyHpRegen({
    id: user.id, currentHp: user.currentHp, maxHp: userStats.hp,
    lastHpUpdate: user.lastHpUpdate || now, roomType: user.roomType, roomUntil: user.roomUntil,
    premiumUntil: user.premiumUntil,
  });
  let userHp = regeneratedHp;
  let bossCurrentHp = boss.currentHp;

  const steps: any[] = [];
  const addStep = (s: any) => steps.push(s);

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
    } else {
      const ctx1: TurnContext = {
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
      const result1 = runTurn(ctx1, addStep);
      userHp = result1.hpActor;
      bossCurrentHp = result1.hpTarget;
      stunnedBoss = result1.stunnedTarget;
    }
    if (bossCurrentHp <= 0) { playerWon = true; break; }

    // Ход босса
    if (stunnedBoss) {
      addStep({ type: 'stun', actor: 'defender', message: `Гильдейский босс оглушён и пропускает ход` });
      stunnedBoss = false;
    } else {
      const ctx2: TurnContext = {
        actorName: 'Гильдейский босс', targetName: user.username,
        actorStats: bossStats, targetStats: userStats,
        actorLevel: boss.level,
        hpActor: bossCurrentHp, hpTarget: userHp,
        maxHpActor: boss.maxHp, maxHpTarget: userStats.hp,
        actor: 'defender', target: 'attacker',
        // Игрок снижает вампиризм босса через targetAntiVampiric
        targetAntiVampiric: antiStats.antiVampiric,
      };
      const result2 = runTurn(ctx2, addStep);
      bossCurrentHp = result2.hpActor;
      userHp = result2.hpTarget;
      stunnedUser = result2.stunnedTarget;
    }
    if (userHp <= 0) break;
    if (bossCurrentHp <= 0) { playerWon = true; break; }
  }

  if (playerWon) {
    addStep({ type: 'end', message: `${user.username} победил босса!` });
  } else {
    addStep({ type: 'end', message: `Гильдейский босс победил!` });
  }

  // Нанесённый урон боссу
  const damageDealt = boss.currentHp - Math.max(0, bossCurrentHp);

  // Сохраняем урон боссу
  const { killed, newKillCount } = await damageBoss(user.guildid, damageDealt);

  // Обновляем кулдаун игрока
  await db.run('UPDATE guild_members SET lastBossAttackAt = ? WHERE userId = ? AND guildId = ?', [now, userId, user.guildid]);

  // +1 личное очко талантов за атаку
  await db.run('UPDATE guild_members SET talentPoints = talentPoints + 1 WHERE userId = ? AND guildId = ?', [userId, user.guildid]);

  // +1 гильдийское очко за убийство
  let guildTalentAwarded = false;
  if (killed) {
    await db.run('UPDATE guilds SET talentPoints = talentPoints + 1 WHERE id = ?', [user.guildid]);
    guildTalentAwarded = true;
  }

  // Сохраняем HP игрока
  const finalHp = Math.max(1, userHp);
  await db.run('UPDATE users SET currentHp = ?, lastHpUpdate = ? WHERE id = ?', [finalHp, now, userId]);

  // ── WS: обновление HP босса для всех членов гильдии ──
  const { sendToGuild } = await import('../events');
  const updatedBoss = await getOrCreateBoss(user.guildid);
  sendToGuild(user.guildid, {
    type: 'guild_boss_update',
    message: `${user.username} нанёс ${damageDealt.toLocaleString()} урона Багровому исполину`,
    data: {
      attackerId: userId,
      attackerName: user.username,
      damageDealt,
      bossHp: updatedBoss.currentHp,
      bossMaxHp: updatedBoss.maxHp,
      bossKilled: killed,
      newKillCount: killed ? newKillCount : boss.killCount,
      newBoss: killed ? {
        maxHp: updatedBoss.maxHp,
        level: updatedBoss.level,
        killCount: updatedBoss.killCount,
        effects: updatedBoss.effects,
      } : null,
    },
  });

  // Уведомление в чат гильдии о результате
  if (killed) {
    sendToGuild(user.guildid, {
      type: 'guild_boss_kill',
      message: `🏆 ${user.username} добил гильдейского босса! Новый босс (уровень ${BOSS_BASE_LEVEL + newKillCount * BOSS_LEVEL_PER_KILL}) пробудился. +1 очко гильдийских талантов.`,
      data: { userId, username: user.username, newKillCount },
    });
  }

  // Гильд-квест PvE
  if (playerWon) {
    updateGuildQuestProgress(user.guildid, 'pve').catch(e => console.error('guildQuest boss PvE:', e.message));
    markDirty(userId, 'quests');
  }

  // Новый босс (если убит)
  const newBoss = killed ? await getOrCreateBoss(user.guildid) : null;

  res.json({
    steps,
    playerWon,
    damageDealt,
    bossKilled: killed,
    guildTalentAwarded,
    newKillCount: killed ? newKillCount : boss.killCount,
    currentHp: finalHp,
    hpAfter: finalHp,
    bossHpAfter: Math.max(0, bossCurrentHp),
    newBoss: newBoss ? {
      maxHp: newBoss.maxHp,
      level: newBoss.level,
      killCount: newBoss.killCount,
      effects: newBoss.effects,
    } : null,
    personalPointsGained: 1,
    guildPointsGained: killed ? 1 : 0,
  });
});

// ── GET /guild/talents — все таланты + очки ──
router.get('/guild/talents', async (req, res) => {
  const userId = req.userId;
  const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null) as any;
  if (!user?.guildid) return res.status(400).json({ error: 'Не в гильдии' });

  const member = await db.one('SELECT talentPoints FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;
  const guild = await db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]) as any;

  const playerTalents = await getPlayerTalents(userId, user.guildid);
  const guildTalents = await getGuildTalents(user.guildid);

  res.json({
    playerPoints: member?.talentpoints || 0,
    guildPoints: guild?.talentpoints || 0,
    talents: TALENT_TYPES.map(t => ({
      type: t,
      label: TALENT_LABELS[t],
      desc: TALENT_DESCS[t],
      playerLevel: playerTalents[t],
      guildLevel: guildTalents[t],
      playerUpgradeCost: getTalentUpgradeCost(playerTalents[t] || 0),
      guildUpgradeCost: getTalentUpgradeCost(guildTalents[t] || 0),
    })),
  });
});

// ── POST /guild/talents/upgrade — прокачка таланта ──
router.post('/guild/talents/upgrade', async (req, res) => {
  const userId = req.userId;
  const { talentType, scope } = req.body as { talentType: TalentType; scope: 'personal' | 'guild' };

  if (!TALENT_TYPES.includes(talentType)) {
    return res.status(400).json({ error: 'Неизвестный тип таланта' });
  }
  if (!['personal', 'guild'].includes(scope)) {
    return res.status(400).json({ error: 'scope должен быть personal или guild' });
  }

  const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]).catch(() => null) as any;
  if (!user?.guildid) return res.status(400).json({ error: 'Не в гильдии' });

  if (scope === 'personal') {
    const member = await db.one('SELECT talentPoints FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;
    const row = await db.one(
      'SELECT level FROM player_guild_talents WHERE userId = ? AND guildId = ? AND talentType = ?',
      [userId, user.guildid, talentType]
    ).catch(() => null) as any;
    const currentLevel = row?.level || 0;
    const cost = getTalentUpgradeCost(currentLevel);

    if (!member || (member.talentpoints || 0) < cost) {
      return res.status(400).json({ error: `Недостаточно очков. Нужно ${cost}, есть ${member?.talentpoints || 0}` });
    }

    if (row) {
      await db.run('UPDATE player_guild_talents SET level = level + 1 WHERE userId = ? AND guildId = ? AND talentType = ?', [userId, user.guildid, talentType]);
    } else {
      await db.run('INSERT INTO player_guild_talents (userId, guildId, talentType, level) VALUES (?, ?, ?, 1)', [userId, user.guildid, talentType]);
    }
    await db.run('UPDATE guild_members SET talentPoints = talentPoints - ? WHERE userId = ? AND guildId = ?', [cost, userId, user.guildid]);

    const talents = await getPlayerTalents(userId, user.guildid);
    const updated = await db.one('SELECT talentPoints FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;

    return res.json({
      success: true,
      scope: 'personal',
      talentType,
      newLevel: talents[talentType],
      remainingPoints: updated.talentpoints,
      talents: TALENT_TYPES.map(t => ({ type: t, label: TALENT_LABELS[t], playerLevel: talents[t] })),
    });
  }

  // Гильдийский талант — права лидера/офицера
  if (scope === 'guild') {
    const member = await db.one('SELECT rank, can_buildings FROM guild_members WHERE userId = ? AND guildId = ?', [userId, user.guildid]) as any;
    if (!member || (member.rank !== 'leader' && !(member.rank === 'officer' && member.can_buildings))) {
      return res.status(403).json({ error: 'Только лидер или офицер с правом построек может улучшать гильдийские таланты' });
    }

    const guild = await db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]) as any;
    const row = await db.one(
      'SELECT level FROM guild_talents WHERE guildId = ? AND talentType = ?',
      [user.guildid, talentType]
    ).catch(() => null) as any;
    const currentLevel = row?.level || 0;
    const cost = getTalentUpgradeCost(currentLevel);

    if (!guild || (guild.talentpoints || 0) < cost) {
      return res.status(400).json({ error: `Недостаточно гильдийских очков. Нужно ${cost}, есть ${guild?.talentpoints || 0}` });
    }

    if (row) {
      await db.run('UPDATE guild_talents SET level = level + 1 WHERE guildId = ? AND talentType = ?', [user.guildid, talentType]);
    } else {
      await db.run('INSERT INTO guild_talents (guildId, talentType, level) VALUES (?, ?, 1)', [user.guildid, talentType]);
    }
    await db.run('UPDATE guilds SET talentPoints = talentPoints - ? WHERE id = ?', [cost, user.guildid]);

    const talents = await getGuildTalents(user.guildid);
    const updated = await db.one('SELECT talentPoints FROM guilds WHERE id = ?', [user.guildid]) as any;

    return res.json({
      success: true,
      scope: 'guild',
      talentType,
      newLevel: talents[talentType],
      remainingPoints: updated.talentpoints,
      talents: TALENT_TYPES.map(t => ({ type: t, label: TALENT_LABELS[t], guildLevel: talents[t] })),
    });
  }
});

export default router;
