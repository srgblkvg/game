import { Router } from 'express';
import { db } from '../db/index';
import { runBattle } from '../game/battle';
import { currentStats } from '../game/stats';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Поиск игроков по имени (autocomplete)
router.get('/players/search', authMiddleware, async (req, res) => {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) return res.json([]);
    try {
        const rows = await db.query(
            `SELECT id, username, level FROM users
             WHERE username ILIKE $1 AND "isGuest" = 0
             ORDER BY level DESC LIMIT 8`,
            [`%${q}%`]
        );
        res.json(rows);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Полная информация об игроке для симуляции
router.get('/players/:id/loadout', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const user = await db.one(
            `SELECT id, username, level, bases, basea, based, basem, equipment, activedrink
             FROM users WHERE id = $1`,
            [id]
        ) as any;
        if (!user) return res.status(404).json({ error: 'Игрок не найден' });

        const collCnt = await db.one(
            'SELECT COUNT(*) as cnt FROM collections WHERE userid = $1', [id]
        ) as any;

        let drinkBonuses = null;
        if (user.activedrink) {
            try {
                const d = JSON.parse(user.activedrink);
                if (d.bonuses) drinkBonuses = d.bonuses;
            } catch {}
        }

        const base = { s: +user.bases, a: +user.basea, d: +user.based, m: +user.basem };
        const equipment = JSON.parse(user.equipment || '{}');
        const collectionBonus = parseInt(collCnt?.cnt || '0');
        const stats = currentStats(base, equipment, drinkBonuses, collectionBonus);

        res.json({
            id: user.id,
            username: user.username,
            level: +user.level,
            base,
            equipment,
            drinkBonuses,
            collectionBonus,
            stats,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Симуляция N боёв между двумя игроками
router.post('/battle-sim', authMiddleware, async (req, res) => {
    const { id1, id2, battles = 100 } = req.body;
    if (!id1 || !id2) return res.status(400).json({ error: 'Укажите id1 и id2' });

    const count = Math.min(Math.max(1, parseInt(battles) || 100), 500);

    try {
        const u1 = await db.one(
            `SELECT id, username, level, bases, basea, based, basem, equipment, activedrink
             FROM users WHERE id = $1`, [id1]
        ) as any;
        const u2 = await db.one(
            `SELECT id, username, level, bases, basea, based, basem, equipment, activedrink
             FROM users WHERE id = $2`, [id2]
        ) as any;
        if (!u1 || !u2) return res.status(404).json({ error: 'Игрок не найден' });

        const c1 = await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userid = $1', [id1]) as any;
        const c2 = await db.one('SELECT COUNT(*) as cnt FROM collections WHERE userid = $1', [id2]) as any;

        const buildPlayer = (u: any, collCnt: number) => {
            let drinks = null;
            if (u.activedrink) {
                try { const d = JSON.parse(u.activedrink); if (d.bonuses) drinks = d.bonuses; } catch {}
            }
            return {
                id: u.id,
                name: u.username,
                base: { s: +u.bases, a: +u.basea, d: +u.based, m: +u.basem },
                equipment: JSON.parse(u.equipment || '{}'),
                level: +u.level,
                money: 0,
                drinkBonuses: drinks,
                collectionBonus: parseInt(collCnt?.cnt || '0'),
            };
        };

        const p1 = buildPlayer(u1, c1?.cnt || 0);
        const p2 = buildPlayer(u2, c2?.cnt || 0);

        const results = [];
        let wins1 = 0, wins2 = 0;
        const allEffects: number[] = [];

        for (let i = 0; i < count; i++) {
            const att = i % 2 === 0 ? p1 : p2;
            const def = i % 2 === 0 ? p2 : p1;
            const r: any = runBattle(att, def);
            r.num = i + 1;
            r.attackerName = att.name;
            r.defenderName = def.name;
            if (r.winnerId === p1.id) wins1++; else wins2++;

            let effects = 0;
            for (const s of r.steps) {
                if (['dodge', 'counter', 'crit', 'block', 'fullBlock', 'stun'].includes(s.type)) effects++;
            }
            allEffects.push(effects);

            results.push({
                num: r.num,
                attackerName: att.name,
                defenderName: def.name,
                winnerName: r.winnerName,
                winnerId: r.winnerId,
                steps: r.steps,
                effects,
            });
        }

        const st1 = currentStats(p1.base, p1.equipment, p1.drinkBonuses, p1.collectionBonus);
        const st2 = currentStats(p2.base, p2.equipment, p2.drinkBonuses, p2.collectionBonus);

        res.json({
            p1: { id: p1.id, name: p1.name, level: p1.level, base: p1.base, stats: st1, collectionBonus: p1.collectionBonus, drinkBonuses: p1.drinkBonuses },
            p2: { id: p2.id, name: p2.name, level: p2.level, base: p2.base, stats: st2, collectionBonus: p2.collectionBonus, drinkBonuses: p2.drinkBonuses },
            wins1, wins2, total: count,
            avgEffects: allEffects.reduce((a, b) => a + b, 0) / count,
            battles: results,
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
