import { Router } from 'express';
import { db } from '../db/index';
import { checkSeasonReset } from '../game/rating';

const router = Router();

// ---------- Действия (action cards) ----------
router.get('/actions', async (req, res) => {
    const actions = await db.query('SELECT * FROM actions_config ORDER BY section, sort_order', []);
    res.json(actions);
});

router.post('/actions', async (req, res) => {
    const { section, title, subtitle, icon, bg_image, path, cost, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    await db.run('INSERT INTO actions_config (section, title, subtitle, icon, bg_image, path, cost, sort_order) VALUES (?,?,?,?,?,?,?,?)',
        [section || 'world', title, subtitle || '', icon || '', bg_image || null, path || null, cost || 0, sort_order || 0]);
    res.json({ success: true });
});

router.put('/actions/:id', async (req, res) => {
    const { section, title, subtitle, icon, bg_image, path, cost, sort_order } = req.body;
    await db.run('UPDATE actions_config SET section=?,title=?,subtitle=?,icon=?,bg_image=?,path=?,cost=?,sort_order=? WHERE id=?',
        [section, title, subtitle, icon, bg_image || null, path || null, cost, sort_order, req.params.id]);
    res.json({ success: true });
});

router.delete('/actions/:id', async (req, res) => {
    await db.run('DELETE FROM actions_config WHERE id=?', [req.params.id]);
    res.json({ success: true });
});

// ---------- Мобы ----------
router.get('/mobs', async (req, res) => {
    const mobs = await db.query('SELECT * FROM mobs ORDER BY location, level', []);
    res.json(mobs);
});

router.put('/mobs/:id', async (req, res) => {
    const { name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max, location, background, description,
        loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic } = req.body;
    await db.run(`UPDATE mobs SET name=?,level=?,hp=?,atk=?,agi=?,def=?,mst=?,xp=?,gold_min=?,gold_max=?,
        location=?,background=?,description=?,
        loot_junk=?,loot_common=?,loot_uncommon=?,loot_rare=?,loot_epic=?,loot_legendary=?,loot_mythic=?
        WHERE id=?`,
        [name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max,
            location, background || null, description || '',
            loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic,
            req.params.id]);
    res.json({ success: true });
});

// Уникальные локации (этажи)
router.get('/mob-locations', async (req, res) => {
    const locs = await db.query('SELECT DISTINCT location FROM mobs ORDER BY location', []);
    res.json(locs.map((l: any) => l.location));
});

// ---------- Этажи ----------
router.get('/floors', async (req, res) => {
    const rows = await db.query('SELECT * FROM floors ORDER BY sort_order, name') as any[];
    const DIFF_MAP: Record<string,number> = {
        'Склеп':0,'Подземелье':0,'Катакомбы':0,'Деревня Пепла':0,
        'Лес Черепов':1,'Старый Тракт':1,'Ядовитые луга':1,'Первый ярус':1,
        'Гнилая Топь':2,'Чёрный Монастырь':2,'Башня Плакальщиц':2,'Некрополь Королей':2,
        'Бездонный Овраг':3,'Врата Бездны':3,
    };
    const DIFF_LABELS = ['Легко','Нормально','Сложно','Ад'];
    const DIFF_ICONS = ['🟢','🟡','🟠','🔴'];
    const result = rows.map(r => ({...r, difficulty: DIFF_MAP[r.name] ?? 0}));
    res.json({ floors: result, groups: DIFF_LABELS.map((label,i) => ({label, icon: DIFF_ICONS[i], difficulty: i})) });
});

router.post('/floors', async (req, res) => {
    const { name, background, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    await db.run('INSERT INTO floors (name, background, sort_order) VALUES (?,?,?)',
        [name, background || null, sort_order || 0]);
    res.json({ success: true });
});

router.put('/floors/:id', async (req, res) => {
    const { name, background, sort_order } = req.body;
    await db.run('UPDATE floors SET name=?, background=?, sort_order=? WHERE id=?',
        [name, background || null, sort_order || 0, req.params.id]);
    res.json({ success: true });
});

router.delete('/floors/:id', async (req, res) => {
    await db.run('DELETE FROM floors WHERE id=?', [req.params.id]);
    res.json({ success: true });
});

// ---------- Сезоны ----------
router.get('/seasons', async (req, res) => {
    const seasons = await db.query('SELECT * FROM seasons ORDER BY id DESC LIMIT 10', []);
    res.json(seasons);
});

router.post('/seasons/finish', async (req, res) => {
    const didReset = await checkSeasonReset();
    if (didReset) {
        const active = await db.one("SELECT * FROM seasons WHERE status = 'active' LIMIT 1") as any;
        res.json({ success: true, message: `Сезон завершён. Новый сезон: ${active?.name || '?'}`, season: active });
    } else {
        res.json({ success: false, message: 'Нет активного сезона для завершения' });
    }
});

export default router;
