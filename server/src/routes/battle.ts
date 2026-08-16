import { Router } from 'express';
import { db } from '../db/index';
import { updateGuildQuestProgress } from './guild';
import { markDirty, refreshCharacter, sendToUser } from '../events';
import { sendLeaderboardLevel } from '../vkLeaderboard';
import { getBaseStats, buildPlayerStats, USER_BATTLE_FIELDS_GUILD, applyExp, collectGuildTax, getCollectionBonus } from '../db/helpers';
import { runBattle } from '../game/battle';
import { currentStats } from '../game/stats';
import { calcElo } from '../game/rating';
import { getDrinkBonuses } from '../game/drinks';
import { applyHpRegen } from '../game/hpRegen';
import { getGuildBonus } from '../game/guildBuildings';
import { checkAchievement, trackIncome } from './achievements';
import { battleSchema } from '../validation';
import { loadBattleAntiStats } from '../game/guildBoss';

const router = Router();

router.post('/battle', async (req, res) => {
    const parsed = battleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные боя' });

    const userId = req.userId;
    const { opponentId } = parsed.data;

    const now = Math.floor(Date.now() / 1000);
    const attacker = await db.one(`SELECT ${USER_BATTLE_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?`, [userId]) as any;
    if (!attacker) return res.status(404).json({ error: 'Attacker not found' });

    const hasPremium = (attacker.premiumUntil || 0) > now;
    let attackCooldown = hasPremium ? 300 : 600; // премиум: 5 мин, базовый: 10 мин
    if (attacker.faction === 'bandit') attackCooldown = Math.floor(attackCooldown / 2);

    if (attacker.lastAttackTime > 0 && (now - attacker.lastAttackTime) < attackCooldown) {
        const remaining = attackCooldown - (now - attacker.lastAttackTime);
        return res.status(400).json({ error: `До следующей атаки осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    let defender: any;
    if (opponentId) {
        defender = await db.one(`SELECT ${USER_BATTLE_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?`, [opponentId]);
        if (!defender || defender.id == userId) return res.status(400).json({ error: 'Invalid opponent' });
    } else {
        const range = attacker.faction === 'bandit' ? 4 : 2;
        const others = await db.query(
            `SELECT ${USER_BATTLE_FIELDS_GUILD} FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id != ? AND u.id > 0 AND (u.protectionUntil IS NULL OR u.protectionUntil < ?) AND u.level >= ? AND u.level <= ?`,
            [userId, now, attacker.level - range, attacker.level + range]
        ) as any[];
        if (others.length === 0) return res.status(400).json({ error: 'Все игроки защищены или вне диапазона уровней' });
        defender = others[Math.floor(Math.random() * others.length)];
    }

    if (defender.protectionUntil > 0 && now < defender.protectionUntil) {
        const remaining = defender.protectionUntil - now;
        return res.status(400).json({ error: `Игрок ${defender.username} защищён ещё ${Math.floor(remaining / 60)} мин` });
    }

    // Проверка диапазона уровней: Бандиты ±4, остальные ±2
    const levelRange = attacker.faction === 'bandit' ? 4 : 2;
    const levelDiff = Math.abs(attacker.level - defender.level);
    if (levelDiff > levelRange) {
        return res.status(400).json({ error: `Разница уровней слишком велика (${levelDiff} > ${levelRange}). Ваш диапазон: ±${levelRange} уровней.` });
    }

    // Актуализируем HP атакующего (офлайн-реген)
    const aGuildBonus = await getGuildBonus(attacker.id, 'arena');
    const attackerStats = await buildPlayerStats(attacker, 'arena');
    const attackerMaxHp = attackerStats.hp;
    const attackerCurrentHp = await applyHpRegen({
        id: attacker.id,
        currentHp: attacker.currentHp,
        maxHp: attackerMaxHp,
        lastHpUpdate: attacker.lastHpUpdate || 0,
        roomType: attacker.roomType,
        roomUntil: attacker.roomUntil,
        premiumUntil: attacker.premiumUntil,
    });

    // Актуализируем HP защитника (офлайн-реген)
    const dGuildBonus = await getGuildBonus(defender.id, 'arena');
    const defenderStats = await buildPlayerStats(defender, 'arena');
    const defenderMaxHp = defenderStats.hp;
    const defenderCurrentHp = await applyHpRegen({
        id: defender.id,
        currentHp: defender.currentHp,
        maxHp: defenderMaxHp,
        lastHpUpdate: defender.lastHpUpdate || 0,
        roomType: defender.roomType,
        roomUntil: defender.roomUntil,
        premiumUntil: defender.premiumUntil,
    });
    const attackerAntiStats = (await loadBattleAntiStats(attacker.id, attacker.guildId || attacker.guildid)).antiStats;
    const defenderAntiStats = (await loadBattleAntiStats(defender.id, defender.guildId || defender.guildid)).antiStats;

    if (attackerCurrentHp < attackerMaxHp * 0.2) {
        return res.status(400).json({ error: 'Для участия в PvP необходимо не менее 20% здоровья' });
    }
    if (defenderCurrentHp < defenderMaxHp * 0.2) {
        return res.status(400).json({ error: 'У противника меньше 20% здоровья. Выберите другую цель' });
    }

    const attackerData = {
        id: attacker.id,
        name: attacker.username,
        base: getBaseStats(attacker),
        equipment: JSON.parse(attacker.equipment || '{}'),
        level: attacker.level,
        money: attacker.money,
        currentHp: attackerCurrentHp,
        drinkBonuses: getDrinkBonuses(attacker),
        collectionBonus: await getCollectionBonus(attacker.id),
        guildBonus: aGuildBonus,
        antiStats: attackerAntiStats,
        faction: attacker.faction || null,
    };
    const defenderData = {
        id: defender.id,
        name: defender.username,
        base: getBaseStats(defender),
        equipment: JSON.parse(defender.equipment || '{}'),
        level: defender.level,
        money: defender.money,
        currentHp: defenderCurrentHp,
        drinkBonuses: getDrinkBonuses(defender),
        collectionBonus: defenderStats.collection || 0,
        guildBonus: dGuildBonus,
        antiStats: defenderAntiStats,
        faction: defender.faction || null,
    };

    // Бонус фракций: Бандит +10% против Ремесленника, Стражник +10% против Бандита
    const FACTION_BONUS = 1.10;
    if (attackerData.faction === 'bandit' && defenderData.faction === 'crafter') {
        attackerData.base = { s: Math.round(attackerData.base.s * FACTION_BONUS), a: Math.round(attackerData.base.a * FACTION_BONUS), d: Math.round(attackerData.base.d * FACTION_BONUS), m: Math.round(attackerData.base.m * FACTION_BONUS) };
    }
    if (attackerData.faction === 'guard' && defenderData.faction === 'bandit') {
        attackerData.base = { s: Math.round(attackerData.base.s * FACTION_BONUS), a: Math.round(attackerData.base.a * FACTION_BONUS), d: Math.round(attackerData.base.d * FACTION_BONUS), m: Math.round(attackerData.base.m * FACTION_BONUS) };
    }

    // --- Проверка: безвыходный бой для защитника? ---
    const attackerFullStats = currentStats(attackerData.base, attackerData.equipment, attackerData.drinkBonuses, attackerData.collectionBonus, attackerData.guildBonus);
    const defenderTotal = defenderStats.s + defenderStats.a + defenderStats.d + defenderStats.m;
    const attackerTotal = attackerFullStats.s + attackerFullStats.a + attackerFullStats.d + attackerFullStats.m;
    const mercyThreshold = attackerTotal > defenderTotal * 2.5 && attackerFullStats.hp > defenderStats.hp * 1.5;

    if (mercyThreshold) {
        // Защитник без шансов — авто-капитуляция, бой не проводится
        // Деньги: 10-50% наличных (как в обычном бою)
        const percent = 0.1 + Math.random() * 0.4;
        let moneyStolen = Math.max(1, Math.floor(defender.money * percent));
        // Бандит: +1% к награбленному за каждые 100 репутации
        const attackerReputation = (attacker.bandit_reputation || 0);
        if (attackerData.faction === 'bandit' && attackerReputation > 0) {
            moneyStolen = Math.floor(moneyStolen * (1 + Math.floor(attackerReputation / 100) / 100));
        }

        // Опыт: как в обычном бою — 2 если цель выше уровнем, 1 если равна, 0 если ниже
        let expGained = 0;
        if (defender.level > attacker.level) expGained = 2;
        else if (defender.level === attacker.level) expGained = 1;

        // ELO: по формуле, как в обычном бою
        const newAttackerElo = calcElo(attacker.elo || 1000, defender.elo || 1000, true, attacker.level);
        const newDefenderElo = calcElo(defender.elo || 1000, attacker.elo || 1000, false, defender.level);
        const eloChange = newAttackerElo - (attacker.elo || 1000);

        const attExp = await applyExp(attacker.id, expGained, attacker.exp, attacker.level, attacker.statPoints || 0);

        // Атакующий
        const attackerMoneyAfterTax = moneyStolen > 0
            ? await collectGuildTax(attacker.id, moneyStolen, 'tax_pvp')
            : 0;
        await db.run(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+1, lastAttackTime=?, lastHpUpdate=?, statPoints=statPoints+?, elo=?, seasonWins=seasonWins+1, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, arenaOpponentId=NULL WHERE id=?`,
            [attExp.newLevel, attExp.newExp, attackerMoneyAfterTax, now, now, attExp.levelsGained * 5, Math.max(100, newAttackerElo), now, moneyStolen, attacker.id]);
        if (attExp.levelsGained > 0) refreshCharacter(attacker.id, 'level');

        // --- Обновление защитника ---
        const protUntil = now + 3600;
        const actualStolen = Math.min(moneyStolen, defender.money);
        await db.run(`UPDATE users SET money=money-?, totalBattles=totalBattles+1, protectionUntil=?, elo=?, seasonLosses=seasonLosses+1, lastPvpTime=?, totalPvpMoneyLost=totalPvpMoneyLost+? WHERE id=?`,
            [actualStolen, protUntil, Math.max(100, newDefenderElo), now, actualStolen, defender.id]);
        sendToUser(defender.id, { type: 'protection', protectionUntil: protUntil });

        // Карма Стражника: +1 за бандита, -1 за остальных
        if (attackerData.faction === 'guard') {
            const karmaChange = defenderData.faction === 'bandit' ? 1 : -1;
            await db.run('UPDATE users SET karma = GREATEST(-100, LEAST(100, karma + ?)) WHERE id = ?', [karmaChange, attacker.id]);
        }
        // Репутация бандита: +1 за победу в PvP
        if (attackerData.faction === 'bandit') {
            await db.run('UPDATE users SET bandit_reputation = bandit_reputation + 1 WHERE id = ?', [attacker.id]);
        }

        // Запись в историю
        await db.run(`INSERT INTO battles (attackerId, defenderId, winnerId, log, steps, attackerHpAfter, defenderHpAfter, expGained, moneyGained, moneyStolen)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [attacker.id, defender.id, attacker.id, JSON.stringify([`${attacker.username} подавляет ${defender.username} без боя`]),
             JSON.stringify([
                { type: 'info', message: `⚔ ${attacker.username} vs ${defender.username}` },
                { type: 'mercy', message: `${defender.username} не рискнул сражаться и отдал ${moneyStolen} серебра` }
             ]),
             attackerFullStats.hp, 0, expGained, moneyStolen, moneyStolen]);

        const updatedAttacker = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;

        // Guild quest progress — track PvP win (mercy)
        if (attacker.guildId) {
            updateGuildQuestProgress(attacker.guildId, 'pvp').catch(e => console.error('guildQuest PvP mercy:', e.message));
        }

        // Достижения и квесты
        checkAchievement(attacker.id, 'pvp_wins').catch(() => {});
        if (moneyStolen > 0) trackIncome(attacker.id, moneyStolen).catch(() => {});
        markDirty(attacker.id, 'quests');

        return res.json({
            mercy: true,
            log: [`${attacker.username} vs ${defender.username}`, `${defender.username} оценил силы и предпочёл не рисковать`],
            steps: [
                { type: 'info', message: `⚔ ${attacker.username} vs ${defender.username}` },
                { type: 'mercy', message: `${defender.username} не рискнул сражаться и отдал ${moneyStolen} серебра` },
                { type: 'info', message: `Рейтинг: ${attacker.username} +${eloChange}, ${defender.username} ${-eloChange >= 0 ? '+' : ''}${-eloChange}` },
            ],
            winnerId: attacker.id,
            hpAfter: attackerFullStats.hp,
            hpDefenderAfter: 0,
            expGained,
            moneyGained: moneyStolen,
            newLevel: attExp.newLevel,
            newExp: attExp.newExp,
            levelsGained: attExp.levelsGained,
            opponent: { name: defenderData.name, level: defenderData.level, equipment: defenderData.equipment, stats: defenderStats },
            moneyAfter: updatedAttacker.money,
            moneyStolen,
            eloChange,
        });
    }

    const result = runBattle(attackerData, defenderData);
    let moneyStolen = result.steps.find((s: any) => s.type === 'money')?.amount || 0;
    // Бандит: +1% к награбленному за каждые 100 репутации
    const attackerReputation = (attacker.bandit_reputation || 0);
    if (attackerData.faction === 'bandit' && attackerReputation > 0) {
        moneyStolen = Math.floor(moneyStolen * (1 + Math.floor(attackerReputation / 100) / 100));
    }
    const attackerWins = result.winnerId === attacker.id;

    // --- Расчёт ELO ---
    const attackerWon = result.winnerId === attacker.id;
    const newAttackerElo = calcElo(attacker.elo || 1000, defender.elo || 1000, attackerWon, attacker.level);
    const newDefenderElo = calcElo(defender.elo || 1000, attacker.elo || 1000, !attackerWon, defender.level);

    // --- Обновление атакующего ---
    const attExp = await applyExp(attacker.id, result.winnerId === attacker.id ? result.expGained : 0, attacker.exp, attacker.level, attacker.statPoints || 0);

    const attackerMoneyDelta = attackerWins ? moneyStolen : -moneyStolen;
    // Не даём уйти в минус проигравшему
    const attackerActualDelta = attackerMoneyDelta < 0
        ? -Math.min(moneyStolen, attacker.money)
        : attackerMoneyDelta;
    // Налог гильдии с PvP-дохода победителя
    const attackerMoneyAfterTax = attackerWins && moneyStolen > 0
        ? await collectGuildTax(attacker.id, moneyStolen, 'tax_pvp')
        : attackerActualDelta;
    await db.run(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, lastAttackTime=?, lastHpUpdate=?, statPoints = statPoints + ?, elo=?, seasonWins=seasonWins+?, seasonLosses=seasonLosses+?, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, totalPvpMoneyLost=totalPvpMoneyLost+?, arenaOpponentId=NULL WHERE id=?`,
        [attExp.newLevel, attExp.newExp, attackerMoneyAfterTax, attackerWins ? 1 : 0, result.attackerHpAfter, now, now, attExp.levelsGained * 5, Math.max(100, newAttackerElo), attackerWon ? 1 : 0, attackerWon ? 0 : 1, now,
            attackerWins ? moneyStolen : 0, attackerWins ? 0 : -attackerActualDelta, attacker.id]);
    if (attExp.levelsGained > 0) refreshCharacter(attacker.id, 'level');

    // VK Leaderboard — атакующий
    if (attExp.levelsGained > 0 && attacker.oauthProvider === 'vk' && attacker.oauthId) {
        sendLeaderboardLevel(attacker.id, attExp.newLevel, String(attacker.oauthId)).catch(() => {});
    }

    // Достижения — победитель (атакующий или защитник)
    if (attackerWins) {
    checkAchievement(attacker.id, 'pvp_wins').catch(() => {});
    if (moneyStolen > 0) trackIncome(attacker.id, moneyStolen).catch(() => {});
    }

    // --- Обновление защитника ---
    const defExp = await applyExp(defender.id, result.winnerId === defender.id ? result.expGained : 0, defender.exp, defender.level, defender.statPoints || 0);

    const defenderMoneyDelta = !attackerWins ? moneyStolen : -moneyStolen;
    // Не даём уйти в минус проигравшему
    const defenderActualDelta = defenderMoneyDelta < 0
        ? -Math.min(moneyStolen, defender.money)
        : defenderMoneyDelta;
    await db.run(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, protectionUntil=?, lastHpUpdate=?, statPoints = statPoints + ?, elo=?, seasonWins=seasonWins+?, seasonLosses=seasonLosses+?, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, totalPvpMoneyLost=totalPvpMoneyLost+? WHERE id=?`,
        [defExp.newLevel, defExp.newExp, defenderActualDelta, !attackerWins ? 1 : 0, result.defenderHpAfter, now + 3600, now, defExp.levelsGained * 5, Math.max(100, newDefenderElo), attackerWon ? 0 : 1, attackerWon ? 1 : 0, now,
            !attackerWins ? moneyStolen : 0, !attackerWins ? 0 : -defenderActualDelta, defender.id]);
    if (defExp.levelsGained > 0) refreshCharacter(defender.id, 'level');
    sendToUser(defender.id, { type: 'protection', protectionUntil: now + 3600 });

    // Достижения — защитник
    if (!attackerWins) {
        checkAchievement(defender.id, 'pvp_wins').catch(() => {});
        if (moneyStolen > 0) trackIncome(defender.id, moneyStolen).catch(() => {});
    }

    // VK Leaderboard — защитник
    if (defExp.levelsGained > 0 && defender.oauthProvider === 'vk' && defender.oauthId) {
        sendLeaderboardLevel(defender.id, defExp.newLevel, String(defender.oauthId)).catch(() => {});
    }

    // Guild quest progress — track PvP wins
    const w = await db.one('SELECT guildId FROM users WHERE id = ?', [result.winnerId]);
    if (w?.guildId) {
        updateGuildQuestProgress(w.guildId, 'pvp').catch(e => console.error('guildQuest PvP:', e.message));
    }

    // Карма Стражника: +1 за бандита, -1 за остальных
    const winnerFaction = attackerWins ? attackerData.faction : defenderData.faction;
    const loserFaction = attackerWins ? defenderData.faction : attackerData.faction;
    if (winnerFaction === 'guard') {
        const karmaChange = loserFaction === 'bandit' ? 1 : -1;
        await db.run('UPDATE users SET karma = GREATEST(-100, LEAST(100, karma + ?)) WHERE id = ?', [karmaChange, result.winnerId]);
    }
    // Репутация бандита: +1 за победу в PvP
    if (winnerFaction === 'bandit') {
        await db.run('UPDATE users SET bandit_reputation = bandit_reputation + 1 WHERE id = ?', [result.winnerId]);
    }

    markDirty(result.winnerId, 'quests');

    // Добавляем шаг с ELO в лог (до сохранения в БД!)
    const attackerEloChange = newAttackerElo - (attacker.elo || 1000);
    const defenderEloChange = newDefenderElo - (defender.elo || 1000);
    const eloChangeWinner = attackerWon ? attackerEloChange : defenderEloChange;
    const eloChangeLoser = attackerWon ? defenderEloChange : attackerEloChange;
    result.steps.push({
        type: 'info',
        message: `Рейтинг: ${attackerWon ? attacker.username : defender.username} +${eloChangeWinner}, ${attackerWon ? defender.username : attacker.username} ${eloChangeLoser >= 0 ? '+' : ''}${eloChangeLoser}`
    });

    await db.run(`INSERT INTO battles (attackerId, defenderId, winnerId, log, steps, attackerHpAfter, defenderHpAfter, expGained, moneyGained, moneyStolen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [attacker.id, defender.id, result.winnerId, JSON.stringify(result.log), JSON.stringify(result.steps),
            result.attackerHpAfter, result.defenderHpAfter, result.expGained, result.moneyGained, moneyStolen]);

    const updatedAttacker = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;

    res.json({
        log: result.log,
        steps: result.steps,
        winnerId: result.winnerId,
        hpAfter: result.attackerHpAfter,
        hpDefenderAfter: result.defenderHpAfter,
        expGained: result.winnerId === attacker.id ? result.expGained : 0,
        moneyGained: attackerWins ? attackerMoneyAfterTax : 0,
        newLevel: attExp.newLevel,
        newExp: attExp.newExp,
        levelsGained: attExp.levelsGained,
        opponent: {
            name: defenderData.name,
            level: defenderData.level,
            equipment: defenderData.equipment,
            stats: defenderStats,
        },
        moneyAfter: updatedAttacker.money,
        moneyStolen,
        eloChange: newAttackerElo - (attacker.elo || 1000),
    });
});

router.get('/battles', async (req, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 10;
    const battles = await db.query(`
    SELECT b.*, 
      a.username as attackerName, ag.name as attackerGuild, a.guildId as attackerGuildId,
      d.username as defenderName, dg.name as defenderGuild, d.guildId as defenderGuildId
    FROM battles b
    JOIN users a ON b.attackerId = a.id
    JOIN users d ON b.defenderId = d.id
    LEFT JOIN guilds ag ON a.guildId = ag.id
    LEFT JOIN guilds dg ON d.guildId = dg.id
    WHERE b.attackerId = ? OR b.defenderId = ?
    ORDER BY b.createdAt DESC
    LIMIT ?
  `, [userId, userId, limit]);
    res.json(battles);
});

// Админка: все бои (отдельный роутер)
export const adminRouter = Router();

adminRouter.get('/battles', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const total = (await db.one('SELECT COUNT(*) as cnt FROM battles', []) as any).cnt;
    const battles = await db.query(`
        SELECT b.*, a.username as attackerName, d.username as defenderName
        FROM battles b
        JOIN users a ON b.attackerId = a.id
        JOIN users d ON b.defenderId = d.id
        ORDER BY b.createdAt DESC LIMIT ? OFFSET ?
    `, [limit, offset]);
    res.json({ battles, total });
});

export default router;
