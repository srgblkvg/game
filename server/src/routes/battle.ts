import { Router } from 'express';
import db from '../database';
import { currentStats } from '../game/stats';
import { runBattle } from '../game/battle';
import { battleSchema } from '../validation';

const router = Router();

router.post('/battle', (req: any, res) => {
    const parsed = battleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные боя' });

    const userId = req.userId;
    const { opponentId } = parsed.data;

    const now = Math.floor(Date.now() / 1000);
    const attacker = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    if (!attacker) return res.status(404).json({ error: 'Attacker not found' });

    if (attacker.lastAttackTime > 0 && (now - attacker.lastAttackTime) < 300) {
        const remaining = 300 - (now - attacker.lastAttackTime);
        return res.status(400).json({ error: `До следующей атаки осталось ${Math.floor(remaining / 60)} мин ${remaining % 60} сек` });
    }

    let defender: any;
    if (opponentId) {
        defender = db.prepare('SELECT * FROM users WHERE id = ?').get(opponentId);
        if (!defender || defender.id == userId) return res.status(400).json({ error: 'Invalid opponent' });
    } else {
        const others = db.prepare('SELECT * FROM users WHERE id != ? AND (protectionUntil IS NULL OR protectionUntil < ?)').all(userId, now) as any[];
        if (others.length === 0) return res.status(400).json({ error: 'Все игроки защищены' });
        defender = others[Math.floor(Math.random() * others.length)];
    }

    if (defender.protectionUntil > 0 && now < defender.protectionUntil) {
        const remaining = defender.protectionUntil - now;
        return res.status(400).json({ error: `Игрок ${defender.username} защищён ещё ${Math.floor(remaining / 60)} мин` });
    }

    const attackerData = {
        id: attacker.id,
        name: attacker.username,
        base: { s: 5 * Math.pow(2, attacker.level - 1), a: 5 * Math.pow(2, attacker.level - 1), v: 100, d: 5 * Math.pow(2, attacker.level - 1), m: 5 * Math.pow(2, attacker.level - 1) },
        equipment: JSON.parse(attacker.equipment || '{}'),
        level: attacker.level,
        money: attacker.money,
    };
    const defenderData = {
        id: defender.id,
        name: defender.username,
        base: { s: 5 * Math.pow(2, defender.level - 1), a: 5 * Math.pow(2, defender.level - 1), v: 100, d: 5 * Math.pow(2, defender.level - 1), m: 5 * Math.pow(2, defender.level - 1) },
        equipment: JSON.parse(defender.equipment || '{}'),
        level: defender.level,
        money: defender.money,
    };

    const result = runBattle(attackerData, defenderData);
    const moneyStolen = result.steps.find((s: any) => s.type === 'money')?.amount || 0;

    if (moneyStolen > 0) {
        if (result.winnerId === attacker.id) {
            db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(moneyStolen, defender.id);
            db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(moneyStolen, attacker.id);
        } else {
            db.prepare('UPDATE users SET money = money - ? WHERE id = ?').run(moneyStolen, attacker.id);
            db.prepare('UPDATE users SET money = money + ? WHERE id = ?').run(moneyStolen, defender.id);
        }
    }

    let newExp = attacker.exp + result.expGained;
    let newLevel = attacker.level;
    const expRequirements = [10, 15, 22, 33, 50, 75, 113, 170, 255, 383];
    while (newLevel < 10) {
        const required = expRequirements[newLevel - 1];
        if (required === undefined) break;
        if (newExp >= required) {
            newExp -= required;
            newLevel++;
        } else break;
    }
    if (newLevel > 10) newLevel = 10;

    db.prepare(`UPDATE users SET level=?, exp=?, money=money+?, totalBattles=totalBattles+1, wins=wins+?, currentHp=?, lastAttackTime=?, lastHpUpdate=? WHERE id=?`)
        .run(newLevel, newExp, result.moneyGained, result.winnerId === attacker.id ? 1 : 0, result.attackerHpAfter, now, now, attacker.id);

    db.prepare(`UPDATE users SET currentHp=?, totalBattles=totalBattles+1, protectionUntil=?, lastHpUpdate=? WHERE id=?`)
        .run(result.defenderHpAfter, now + 3600, now, defender.id);

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
        hpDefenderAfter: result.defenderHpAfter,   // <-- добавить
        expGained: result.expGained,
        moneyGained: result.moneyGained,
        newLevel,
        newExp,
        opponent: {
            name: defenderData.name,
            level: defenderData.level,
            equipment: defenderData.equipment,
            stats: currentStats(defenderData.base, defenderData.equipment),
        },
        moneyAfter: updatedAttacker.money,
        moneyStolen,
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

export default router;