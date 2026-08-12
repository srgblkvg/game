"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../db/index");
const battle_1 = require("../game/battle");
const stats_1 = require("../game/stats");
const auth_1 = require("../middleware/auth");
const helpers_1 = require("../db/helpers");
const router = (0, express_1.Router)();
// Поиск игроков по имени (autocomplete)
router.get('/players/search', auth_1.authMiddleware, async (req, res) => {
    const q = (req.query.q || '').trim();
    if (q.length < 2)
        return res.json([]);
    try {
        const rows = await index_1.db.query(`SELECT id, username, level FROM users
             WHERE username ILIKE ? AND isGuest = 0
             ORDER BY level DESC LIMIT 8`, [`%${q}%`]);
        res.json(rows);
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Полная информация об игроке для симуляции
router.get('/players/:id/loadout', auth_1.authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const user = await index_1.db.one(`SELECT id, username, level, bases, basea, based, basem, equipment, activedrink
             FROM users WHERE id = ?`, [id]);
        if (!user)
            return res.status(404).json({ error: 'Игрок не найден' });
        const collectionBonus = await (0, helpers_1.getCollectionBonus)(id);
        let drinkBonuses = null;
        if (user.activedrink) {
            try {
                const d = JSON.parse(user.activedrink);
                if (d.bonuses)
                    drinkBonuses = d.bonuses;
            }
            catch { }
        }
        const base = { s: +user.bases, a: +user.basea, d: +user.based, m: +user.basem };
        const equipment = JSON.parse(user.equipment || '{}');
        const stats = (0, stats_1.currentStats)(base, equipment, drinkBonuses, collectionBonus);
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Симуляция N боёв между двумя игроками
router.post('/battle-sim', auth_1.authMiddleware, async (req, res) => {
    const { id1, id2, battles = 100 } = req.body;
    if (!id1 || !id2)
        return res.status(400).json({ error: 'Укажите id1 и id2' });
    const count = Math.min(Math.max(1, parseInt(battles) || 100), 500);
    try {
        const u1 = await index_1.db.one(`SELECT id, username, level, bases, basea, based, basem, equipment, activedrink, drinkuntil, guildid
             FROM users WHERE id = ?`, [id1]);
        const u2 = await index_1.db.one(`SELECT id, username, level, bases, basea, based, basem, equipment, activedrink, drinkuntil, guildid
             FROM users WHERE id = ?`, [id2]);
        if (!u1 || !u2)
            return res.status(404).json({ error: 'Игрок не найден' });
        const s1 = await (0, helpers_1.buildPlayerStats)(u1, 'arena');
        const s2 = await (0, helpers_1.buildPlayerStats)(u2, 'arena');
        const p1 = { id: u1.id, name: u1.username, base: { s: +u1.bases, a: +u1.basea, d: +u1.based, m: +u1.basem }, equipment: JSON.parse(u1.equipment || '{}'), level: +u1.level, money: 0, stats: s1 };
        const p2 = { id: u2.id, name: u2.username, base: { s: +u2.bases, a: +u2.basea, d: +u2.based, m: +u2.basem }, equipment: JSON.parse(u2.equipment || '{}'), level: +u2.level, money: 0, stats: s2 };
        const results = [];
        let wins1 = 0, wins2 = 0;
        const allEffects = [];
        for (let i = 0; i < count; i++) {
            const att = i % 2 === 0 ? p1 : p2;
            const def = i % 2 === 0 ? p2 : p1;
            const r = (0, battle_1.runBattle)(att, def);
            r.num = i + 1;
            r.attackerName = att.name;
            r.defenderName = def.name;
            if (r.winnerId === p1.id)
                wins1++;
            else
                wins2++;
            let effects = 0;
            for (const s of r.steps) {
                if (['dodge', 'counter', 'crit', 'block', 'fullBlock', 'stun'].includes(s.type))
                    effects++;
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
        const st1 = p1.stats;
        const st2 = p2.stats;
        res.json({
            p1: { id: p1.id, name: p1.name, level: p1.level, base: p1.base, stats: st1 },
            p2: { id: p2.id, name: p2.name, level: p2.level, base: p2.base, stats: st2 },
            wins1, wins2, total: count,
            avgEffects: allEffects.reduce((a, b) => a + b, 0) / count,
            battles: results,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=battleSim.js.map