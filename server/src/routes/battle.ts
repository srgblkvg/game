import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
import { getBaseStats, collectGuildTax, applyExp } from '../db/helpers';
import { runBattle } from '../game/battle';
import { calcElo } from '../game/rating';
import { getDrinkBonuses } from '../game/drinks';
import { applyHpRegen } from '../game/hpRegen';
import { battleSchema } from '../validation';

const router = Router();

router.post('/battle', async (req: any, res) => {
    const parsed = battleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные боя' });

    const userId = req.userId;
    const { opponentId } = parsed.data;

    const now = Math.floor(Date.now() / 1000);
    const attacker = await db.prepareGet('SELECT u.id, u.username, u.level, u.exp, u.currentHp, u.elo, u.seasonWins, u.seasonLosses, u.equipment, u.baseS, u.baseA, u.baseD, u.baseM, u.money, u.inventorySlots, u.lastAttackTime, u.premiumUntil, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?')(userId) as any;
    if (!attacker) return res.status(404).json({ error: 'Attacker not found' });

    const hasPremium = (attacker.premiumUntil || 0) > now;
    const attackCooldown = hasPremium ? 150 : 300; // премиум: 2.5 мин вместо 5

    if (attacker.lastAttackTime > 0 && (now - attacker.lastAttackTime) < attackCooldown) {
        const remaining = attackCooldown - (now - attacker.lastAttackTime);
        return res.status(400).json({ error: `До следующей атаки осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    let defender: any;
    if (opponentId) {
        defender = await db.prepareGet('SELECT u.id, u.username, u.level, u.exp, u.currentHp, u.elo, u.seasonWins, u.seasonLosses, u.equipment, u.baseS, u.baseA, u.baseD, u.baseM, u.money, u.inventorySlots, u.protectionUntil, u.roomType, u.roomUntil, u.lastHpUpdate, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?')(opponentId);
        if (!defender || defender.id == userId) return res.status(400).json({ error: 'Invalid opponent' });
    } else {
        const others = await db.prepareAll('SELECT u.id, u.username, u.level, u.exp, u.currentHp, u.elo, u.seasonWins, u.seasonLosses, u.equipment, u.baseS, u.baseA, u.baseD, u.baseM, u.money, u.inventorySlots, u.protectionUntil, u.roomType, u.roomUntil, u.lastHpUpdate, g.name as guildName FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id != ? AND u.id > 0 AND (u.protectionUntil IS NULL OR u.protectionUntil < ?)')(userId, now) as any[];
        if (others.length === 0) return res.status(400).json({ error: 'Все игроки защищены' });
        defender = others[Math.floor(Math.random() * others.length)];
    }

    if (defender.protectionUntil > 0 && now < defender.protectionUntil) {
        const remaining = defender.protectionUntil - now;
        return res.status(400).json({ error: `Игрок ${defender.username} защищён ещё ${Math.floor(remaining / 60)} мин` });
    }

    // Актуализируем HP защитника (офлайн-реген)
    const dCollCnt = (await db.prepareGet('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?')(defender.id) as any).cnt || 0;
    const defenderMaxHp = currentStats(getBaseStats(defender), JSON.parse(defender.equipment || '{}'), undefined, dCollCnt).hp;
    const defenderCurrentHp = applyHpRegen({
        id: defender.id,
        currentHp: defender.currentHp,
        maxHp: defenderMaxHp,
        lastHpUpdate: defender.lastHpUpdate || 0,
        roomType: defender.roomType,
        roomUntil: defender.roomUntil,
    });

    const attackerData = {
        id: attacker.id,
        name: attacker.username,
        base: getBaseStats(attacker),
        equipment: JSON.parse(attacker.equipment || '{}'),
        level: attacker.level,
        money: attacker.money,
        currentHp: attacker.currentHp ?? undefined,
        drinkBonuses: getDrinkBonuses(attacker),
        collectionBonus: (await db.prepareGet('SELECT COUNT(*) as cnt FROM collections WHERE userId = ?')(attacker.id) as any).cnt || 0,
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
        collectionBonus: dCollCnt,
    };

    const result = runBattle(attackerData, defenderData);
    const moneyStolen = result.steps.find((s: any) => s.type === 'money')?.amount || 0;
    const attackerWins = result.winnerId === attacker.id;

    if (moneyStolen > 0) {
        if (attackerWins) {
            await db.prepareRun('UPDATE users SET money = money - ? WHERE id = ?')(moneyStolen, defender.id);
            await db.prepareRun('UPDATE users SET money = money + ? WHERE id = ?')(moneyStolen, attacker.id);
        } else {
            await db.prepareRun('UPDATE users SET money = money - ? WHERE id = ?')(moneyStolen, attacker.id);
            await db.prepareRun('UPDATE users SET money = money + ? WHERE id = ?')(moneyStolen, defender.id);
        }
    }

    // --- Расчёт ELO ---
    const attackerWon = result.winnerId === attacker.id;
    const newAttackerElo = calcElo(attacker.elo || 1000, defender.elo || 1000, attackerWon, attacker.level);
    const newDefenderElo = calcElo(defender.elo || 1000, attacker.elo || 1000, !attackerWon, defender.level);

    // --- Обновление атакующего ---
    const attExp = applyExp(db, attacker.id, result.winnerId === attacker.id ? result.expGained : 0, attacker.exp, attacker.level, attacker.statPoints || 0);

    // Налог гильдии (PvP)
    const attackerMoneyAfterTax = collectGuildTax(db, attacker.id, attackerWins ? result.moneyGained : 0, 'tax_pvp');

    await db.prepareRun(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, lastAttackTime=?, lastHpUpdate=?, statPoints = statPoints + ?, elo=?, seasonWins=seasonWins+?, seasonLosses=seasonLosses+?, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, totalPvpMoneyLost=totalPvpMoneyLost+?, arenaOpponentId=NULL WHERE id=?`)(attExp.newLevel, attExp.newExp, attackerMoneyAfterTax, attackerWins ? 1 : 0, result.attackerHpAfter, now, now, attExp.levelsGained * 5, Math.max(100, newAttackerElo), attackerWon ? 1 : 0, attackerWon ? 0 : 1, now,
            attackerWins ? (result.moneyGained + moneyStolen) : 0, attackerWins ? 0 : moneyStolen, attacker.id);

    // --- Обновление защитника ---
    const defExp = applyExp(db, defender.id, result.winnerId === defender.id ? result.expGained : 0, defender.exp, defender.level, defender.statPoints || 0);

    // Налог гильдии (PvP защитник)
    const defenderMoneyAfterTax = collectGuildTax(db, defender.id, !attackerWins ? result.moneyGained : 0, 'tax_pvp');

    await db.prepareRun(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, protectionUntil=?, lastHpUpdate=?, statPoints = statPoints + ?, elo=?, seasonWins=seasonWins+?, seasonLosses=seasonLosses+?, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, totalPvpMoneyLost=totalPvpMoneyLost+? WHERE id=?`)(defLevel, defExpRemain, defenderMoneyAfterTax, !attackerWins ? 1 : 0, result.defenderHpAfter, now + 3600, now, defLevelsGained * 5, Math.max(100, newDefenderElo), attackerWon ? 0 : 1, attackerWon ? 1 : 0, now,
            !attackerWins ? (result.moneyGained + moneyStolen) : 0, !attackerWins ? 0 : moneyStolen, defender.id);

    await db.prepareRun(`INSERT INTO battles (attackerId, defenderId, winnerId, log, steps, attackerHpAfter, defenderHpAfter, expGained, moneyGained, moneyStolen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)(attacker.id, defender.id, result.winnerId, JSON.stringify(result.log), JSON.stringify(result.steps),
            result.attackerHpAfter, result.defenderHpAfter, result.expGained, result.moneyGained, moneyStolen);

    const updatedAttacker = await db.prepareGet('SELECT money FROM users WHERE id = ?')(userId) as any;

    res.json({
        log: result.log,
        steps: result.steps,
        winnerId: result.winnerId,
        hpAfter: result.attackerHpAfter,
        hpDefenderAfter: result.defenderHpAfter,
        expGained: result.winnerId === attacker.id ? result.expGained : 0,
        moneyGained: attackerWins ? (result.moneyGained + moneyStolen) : 0,
        newLevel: attExp.newLevel,
        newExp: attExp.newExp,
        levelsGained: attExp.levelsGained,
        opponent: {
            name: defenderData.name,
            level: defenderData.level,
            equipment: defenderData.equipment,
            stats: currentStats(defenderData.base, defenderData.equipment, undefined, defenderData.collectionBonus),
        },
        moneyAfter: updatedAttacker.money,
        moneyStolen,
        eloChange: newAttackerElo - (attacker.elo || 1000),
    });
});

router.get('/battles', async (req: any, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 10;
    const battles = await db.prepareAll(`
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
  `)(userId, userId, limit);
    res.json(battles);
});

// Админка: все бои (отдельный роутер)
export const adminRouter = Router();

adminRouter.get('/battles', async (req: any, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const total = (await db.prepareGet('SELECT COUNT(*) as cnt FROM battles')() as any).cnt;
    const battles = await db.prepareAll(`
        SELECT b.*, a.username as attackerName, d.username as defenderName
        FROM battles b
        JOIN users a ON b.attackerId = a.id
        JOIN users d ON b.defenderId = d.id
        ORDER BY b.createdAt DESC LIMIT ? OFFSET ?
    `)(limit, offset);
    res.json({ battles, total });
});

export default router;