import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
import { getBaseStats } from '../db/helpers';
import { runBattle } from '../game/battle';
import { calcElo } from '../game/rating';
import { getDrinkBonuses } from '../game/drinks';
import { applyHpRegen } from '../game/hpRegen';
import { battleSchema } from '../validation';

const router = Router();

router.post('/battle', (req: any, res) => {
    const parsed = battleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные боя' });

    const userId = req.userId;
    const { opponentId } = parsed.data;

    const now = Math.floor(Date.now() / 1000);
    const attacker = db.prepare('SELECT id, username, level, exp, currentHp, elo, seasonWins, seasonLosses, equipment, baseS, baseA, baseD, baseM, money, inventorySlots, lastAttackTime, premiumUntil FROM users WHERE id = ?').get(userId) as any;
    if (!attacker) return res.status(404).json({ error: 'Attacker not found' });

    const hasPremium = (attacker.premiumUntil || 0) > now;
    const attackCooldown = hasPremium ? 150 : 300; // премиум: 2.5 мин вместо 5

    if (attacker.lastAttackTime > 0 && (now - attacker.lastAttackTime) < attackCooldown) {
        const remaining = attackCooldown - (now - attacker.lastAttackTime);
        return res.status(400).json({ error: `До следующей атаки осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    let defender: any;
    if (opponentId) {
        defender = db.prepare('SELECT id, username, level, exp, currentHp, elo, seasonWins, seasonLosses, equipment, baseS, baseA, baseD, baseM, money, inventorySlots, protectionUntil, roomType, roomUntil, lastHpUpdate FROM users WHERE id = ?').get(opponentId);
        if (!defender || defender.id == userId) return res.status(400).json({ error: 'Invalid opponent' });
    } else {
        const others = db.prepare('SELECT id, username, level, exp, currentHp, elo, seasonWins, seasonLosses, equipment, baseS, baseA, baseD, baseM, money, inventorySlots, protectionUntil, roomType, roomUntil, lastHpUpdate FROM users WHERE id != ? AND id > 0 AND (protectionUntil IS NULL OR protectionUntil < ?)').all(userId, now) as any[];
        if (others.length === 0) return res.status(400).json({ error: 'Все игроки защищены' });
        defender = others[Math.floor(Math.random() * others.length)];
    }

    if (defender.protectionUntil > 0 && now < defender.protectionUntil) {
        const remaining = defender.protectionUntil - now;
        return res.status(400).json({ error: `Игрок ${defender.username} защищён ещё ${Math.floor(remaining / 60)} мин` });
    }

    // Актуализируем HP защитника (офлайн-реген)
    const defenderMaxHp = currentStats(getBaseStats(defender), JSON.parse(defender.equipment || '{}')).hp;
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
    };

    const result = runBattle(attackerData, defenderData);
    const moneyStolen = result.steps.find((s: any) => s.type === 'money')?.amount || 0;
    const attackerWins = result.winnerId === attacker.id;

    if (moneyStolen > 0) {
        if (attackerWins) {
            db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(moneyStolen, defender.id);
            db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(moneyStolen, attacker.id);
        } else {
            db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(moneyStolen, attacker.id);
            db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(moneyStolen, defender.id);
        }
    }

    // --- Расчёт ELO ---
    const attackerWon = result.winnerId === attacker.id;
    const newAttackerElo = calcElo(attacker.elo || 1000, defender.elo || 1000, attackerWon, attacker.level);
    const newDefenderElo = calcElo(defender.elo || 1000, attacker.elo || 1000, !attackerWon, defender.level);

    // --- Обновление атакующего ---
    let newExp = attacker.exp + (result.winnerId === attacker.id ? result.expGained : 0);
    let newLevel = attacker.level;
    let levelsGained = 0;
    while (true) {
        const required = 10 * Math.pow(2, newLevel - 1);
        if (newExp >= required) { newExp -= required; newLevel++; levelsGained++; }
        else break;
    }

    db.prepare(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, lastAttackTime=?, lastHpUpdate=?, statPoints = statPoints + ?, elo=?, seasonWins=seasonWins+?, seasonLosses=seasonLosses+?, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, totalPvpMoneyLost=totalPvpMoneyLost+? WHERE id=?`)
        .run(newLevel, newExp, attackerWins ? result.moneyGained : 0, attackerWins ? 1 : 0, result.attackerHpAfter, now, now, levelsGained * 5, Math.max(100, newAttackerElo), attackerWon ? 1 : 0, attackerWon ? 0 : 1, now,
            attackerWins ? (result.moneyGained + moneyStolen) : 0, attackerWins ? 0 : moneyStolen, attacker.id);

    // --- Обновление защитника ---
    const defExp = defender.exp + (result.winnerId === defender.id ? result.expGained : 0);
    let defLevel = defender.level;
    let defLevelsGained = 0;
    let defExpRemain = defExp;
    while (true) {
        const required = 10 * Math.pow(2, defLevel - 1);
        if (defExpRemain >= required) { defExpRemain -= required; defLevel++; defLevelsGained++; }
        else break;
    }

    db.prepare(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, protectionUntil=?, lastHpUpdate=?, statPoints = statPoints + ?, elo=?, seasonWins=seasonWins+?, seasonLosses=seasonLosses+?, lastPvpTime=?, totalPvpMoneyWon=totalPvpMoneyWon+?, totalPvpMoneyLost=totalPvpMoneyLost+? WHERE id=?`)
        .run(defLevel, defExpRemain, !attackerWins ? result.moneyGained : 0, !attackerWins ? 1 : 0, result.defenderHpAfter, now + 3600, now, defLevelsGained * 5, Math.max(100, newDefenderElo), attackerWon ? 0 : 1, attackerWon ? 1 : 0, now,
            !attackerWins ? (result.moneyGained + moneyStolen) : 0, !attackerWins ? 0 : moneyStolen, defender.id);

    db.prepare(`INSERT INTO battles (attackerId, defenderId, winnerId, log, steps, attackerHpAfter, defenderHpAfter, expGained, moneyGained, moneyStolen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(attacker.id, defender.id, result.winnerId, JSON.stringify(result.log), JSON.stringify(result.steps),
            result.attackerHpAfter, result.defenderHpAfter, result.expGained, result.moneyGained, moneyStolen);

    const updatedAttacker = db.prepare('SELECT money FROM users WHERE id = ?').get(userId) as any;

    res.json({
        log: result.log,
        steps: result.steps,
        winnerId: result.winnerId,
        hpAfter: result.attackerHpAfter,
        hpDefenderAfter: result.defenderHpAfter,
        expGained: result.winnerId === attacker.id ? result.expGained : 0,
        moneyGained: attackerWins ? (result.moneyGained + moneyStolen) : 0,
        newLevel,
        newExp,
        levelsGained,
        opponent: {
            name: defenderData.name,
            level: defenderData.level,
            equipment: defenderData.equipment,
            stats: currentStats(defenderData.base, defenderData.equipment),
        },
        moneyAfter: updatedAttacker.money,
        moneyStolen,
        eloChange: newAttackerElo - (attacker.elo || 1000),
    });
});

router.get('/battles', (req: any, res) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 10;
    const battles = db.prepare(`
    SELECT b.*, 
      a.username as attackerName, 
      d.username as defenderName
    FROM battles b
    JOIN users a ON b.attackerId = a.id
    JOIN users d ON b.defenderId = d.id
    WHERE b.attackerId = ? OR b.defenderId = ?
    ORDER BY b.createdAt DESC
    LIMIT ?
  `).all(userId, userId, limit);
    res.json(battles);
});

// Админка: все бои (отдельный роутер)
export const adminRouter = Router();

adminRouter.get('/battles', (req: any, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const total = (db.prepare('SELECT COUNT(*) as cnt FROM battles').get() as any).cnt;
    const battles = db.prepare(`
        SELECT b.*, a.username as attackerName, d.username as defenderName
        FROM battles b
        JOIN users a ON b.attackerId = a.id
        JOIN users d ON b.defenderId = d.id
        ORDER BY b.createdAt DESC LIMIT ? OFFSET ?
    `).all(limit, offset);
    res.json({ battles, total });
});

export default router;