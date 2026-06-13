import { Router } from 'express';
import db from '../database';

const router = Router();

// ---------- Действия (action cards) ----------
router.get('/actions', (_req: any, res) => {
    const actions = db.prepare('SELECT * FROM actions_config ORDER BY section, sort_order').all();
    res.json(actions);
});

router.post('/actions', (req, res) => {
    const { section, title, subtitle, icon, bg_image, path, cost, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    db.prepare('INSERT INTO actions_config (section, title, subtitle, icon, bg_image, path, cost, sort_order) VALUES (?,?,?,?,?,?,?,?)')
        .run(section || 'world', title, subtitle || '', icon || '', bg_image || null, path || null, cost || 0, sort_order || 0);
    res.json({ success: true });
});

router.put('/actions/:id', (req, res) => {
    const { section, title, subtitle, icon, bg_image, path, cost, sort_order } = req.body;
    db.prepare('UPDATE actions_config SET section=?,title=?,subtitle=?,icon=?,bg_image=?,path=?,cost=?,sort_order=? WHERE id=?')
        .run(section, title, subtitle, icon, bg_image || null, path || null, cost, sort_order, req.params.id);
    res.json({ success: true });
});

router.delete('/actions/:id', (req, res) => {
    db.prepare('DELETE FROM actions_config WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ---------- Мобы ----------
router.get('/mobs', (_req: any, res) => {
    const mobs = db.prepare('SELECT * FROM mobs ORDER BY location, level').all();
    res.json(mobs);
});

router.put('/mobs/:id', (req, res) => {
    const { name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max, location, background, description,
        loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic } = req.body;
    db.prepare(`UPDATE mobs SET name=?,level=?,hp=?,atk=?,agi=?,def=?,mst=?,xp=?,gold_min=?,gold_max=?,
        location=?,background=?,description=?,
        loot_junk=?,loot_common=?,loot_uncommon=?,loot_rare=?,loot_epic=?,loot_legendary=?,loot_mythic=?
        WHERE id=?`)
        .run(name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max,
            location, background || null, description || '',
            loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic,
            req.params.id);
    res.json({ success: true });
});

// Уникальные локации (этажи)
router.get('/mob-locations', (_req: any, res) => {
    const locs = db.prepare('SELECT DISTINCT location FROM mobs ORDER BY location').all();
    res.json(locs.map((l: any) => l.location));
});

// ---------- Этажи ----------
router.get('/floors', (_req: any, res) => {
    res.json(db.prepare('SELECT * FROM floors ORDER BY sort_order, name').all());
});

router.post('/floors', (req, res) => {
    const { name, background, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    db.prepare('INSERT INTO floors (name, background, sort_order) VALUES (?,?,?)')
        .run(name, background || null, sort_order || 0);
    res.json({ success: true });
});

router.put('/floors/:id', (req, res) => {
    const { name, background, sort_order } = req.body;
    db.prepare('UPDATE floors SET name=?, background=?, sort_order=? WHERE id=?')
        .run(name, background || null, sort_order || 0, req.params.id);
    res.json({ success: true });
});

router.delete('/floors/:id', (req, res) => {
    db.prepare('DELETE FROM floors WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

export default router;
