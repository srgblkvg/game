import { Router } from 'express';
import db from '../database';

const router = Router();

// ---------- Действия (action cards) ----------
router.get('/actions', async (_req: any, res) => {
    const actions = await db.prepareAll('SELECT * FROM actions_config ORDER BY section, sort_order')();
    res.json(actions);
});

router.post('/actions', async (req, res) => {
    const { section, title, subtitle, icon, bg_image, path, cost, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    await db.prepareRun('INSERT INTO actions_config (section, title, subtitle, icon, bg_image, path, cost, sort_order) VALUES (?,?,?,?,?,?,?,?)')(section || 'world', title, subtitle || '', icon || '', bg_image || null, path || null, cost || 0, sort_order || 0);
    res.json({ success: true });
});

router.put('/actions/:id', async (req, res) => {
    const { section, title, subtitle, icon, bg_image, path, cost, sort_order } = req.body;
    await db.prepareRun('UPDATE actions_config SET section=?,title=?,subtitle=?,icon=?,bg_image=?,path=?,cost=?,sort_order=? WHERE id=?')(section, title, subtitle, icon, bg_image || null, path || null, cost, sort_order, req.params.id);
    res.json({ success: true });
});

router.delete('/actions/:id', async (req, res) => {
    await db.prepareRun('DELETE FROM actions_config WHERE id=?')(req.params.id);
    res.json({ success: true });
});

// ---------- Мобы ----------
router.get('/mobs', async (_req: any, res) => {
    const mobs = await db.prepareAll('SELECT * FROM mobs ORDER BY location, level')();
    res.json(mobs);
});

router.put('/mobs/:id', async (req, res) => {
    const { name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max, location, background, description,
        loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic } = req.body;
    await db.prepareRun(`UPDATE mobs SET name=?,level=?,hp=?,atk=?,agi=?,def=?,mst=?,xp=?,gold_min=?,gold_max=?,
        location=?,background=?,description=?,
        loot_junk=?,loot_common=?,loot_uncommon=?,loot_rare=?,loot_epic=?,loot_legendary=?,loot_mythic=?
        WHERE id=?`)(name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max,
            location, background || null, description || '',
            loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic,
            req.params.id);
    res.json({ success: true });
});

// Уникальные локации (этажи)
router.get('/mob-locations', async (_req: any, res) => {
    const locs = await db.prepareAll('SELECT DISTINCT location FROM mobs ORDER BY location')();
    res.json(locs.map((l: any) => l.location));
});

// ---------- Этажи ----------
router.get('/floors', async (_req: any, res) => {
    res.json(await db.prepareAll('SELECT * FROM floors ORDER BY sort_order, name')());
});

router.post('/floors', async (req, res) => {
    const { name, background, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    await db.prepareRun('INSERT INTO floors (name, background, sort_order) VALUES (?,?,?)')(name, background || null, sort_order || 0);
    res.json({ success: true });
});

router.put('/floors/:id', async (req, res) => {
    const { name, background, sort_order } = req.body;
    await db.prepareRun('UPDATE floors SET name=?, background=?, sort_order=? WHERE id=?')(name, background || null, sort_order || 0, req.params.id);
    res.json({ success: true });
});

router.delete('/floors/:id', async (req, res) => {
    await db.prepareRun('DELETE FROM floors WHERE id=?')(req.params.id);
    res.json({ success: true });
});

export default router;
