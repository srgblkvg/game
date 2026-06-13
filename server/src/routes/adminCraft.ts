import { Router } from 'express';
import db from '../database';

const router = Router();

// ==================== Ресурсы (craft_items) ====================
router.get('/craft-items', (req, res) => {
    const items = await db.prepareAll(`
        SELECT c.*, r.name as rarity_name, r.display_name as rarity_display, r.color as rarity_color
        FROM craft_items c
        JOIN rarities r ON c.rarity_id = r.id
        ORDER BY c.id
    `)();
    res.json(items);
});

router.post('/craft-items', (req, res) => {
    const { name, rarity_id, description, type, image } = req.body;
    if (!name || rarity_id === undefined) return res.status(400).json({ error: 'name, rarity_id required' });
    await db.prepareRun('INSERT INTO craft_items (name, rarity_id, description, type, image) VALUES (?, ?, ?, ?, ?)')(name, rarity_id, description || '', type || 'craft', image || null);
    res.json({ success: true });
});

router.put('/craft-items/:id', (req, res) => {
    const { name, rarity_id, description, type, image } = req.body;
    await db.prepareRun('UPDATE craft_items SET name=?, rarity_id=?, description=?, type=?, image=? WHERE id=?')(name, rarity_id, description, type || 'craft', image || null, req.params.id);
    res.json({ success: true });
});

router.delete('/craft-items/:id', (req, res) => {
    await db.prepareRun('DELETE FROM craft_items WHERE id=?')(req.params.id);
    res.json({ success: true });
});

// ==================== Рецепты (craft_recipes) ====================
router.get('/recipes', (req, res) => {
    const recipes = await db.prepareAll('SELECT * FROM craft_recipes ORDER BY id')() as any[];
    for (const recipe of recipes) {
        recipe.ingredients = await db.prepareAll(`
            SELECT ci.id, ci.name, ci.rarity_id, ci.type as itemType, ci.image, cri.quantity,
                   r.display_name as rarity_display, r.color as rarity_color
            FROM craft_recipe_ingredients cri
            JOIN craft_items ci ON ci.id = cri.craft_item_id
            JOIN rarities r ON ci.rarity_id = r.id
            WHERE cri.recipe_id = ?
        `)(recipe.id);

        if (recipe.result_type === 'item') {
            recipe.result = await db.prepareGet(`
                SELECT i.id, i.name, i.slot, i.rarity_id, i.image,
                       r.display_name as rarity_display, r.color as rarity_color
                FROM items i
                JOIN rarities r ON i.rarity_id = r.id
                WHERE i.id = ?
            `)(recipe.result_id) || null;
        } else if (recipe.result_type === 'craft_item') {
            recipe.result = await db.prepareGet(`
                SELECT c.id, c.name, c.rarity_id, c.image,
                       r.display_name as rarity_display, r.color as rarity_color
                FROM craft_items c
                JOIN rarities r ON c.rarity_id = r.id
                WHERE c.id = ?
            `)(recipe.result_id) || null;
        } else {
            recipe.result = null;
        }

        recipe.category = await db.prepareGet('SELECT * FROM craft_recipe_categories WHERE id = ?')(recipe.category_id) || null;
    }
    res.json(recipes);
});

router.post('/recipes', (req, res) => {
    const { name, description, money_cost, ingredients, result_type, result_id, success_chance, category_id } = req.body;
    if (!name || money_cost === undefined) return res.status(400).json({ error: 'name, money_cost required' });

    const result = db.prepare(
        'INSERT INTO craft_recipes (name, description, money_cost, result_type, result_id, success_chance, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, description || '', money_cost, result_type || '', result_id || 0, success_chance ?? 100, category_id || null);

    const recipeId = result.lastInsertRowid;

    if (ingredients && Array.isArray(ingredients)) {
        const stmt = db.prepare('INSERT INTO craft_recipe_ingredients (recipe_id, craft_item_id, quantity) VALUES (?, ?, ?)');
        for (const ing of ingredients) {
            stmt.run(recipeId, ing.craft_item_id, ing.quantity);
        }
    }
    res.json({ success: true, id: recipeId });
});

router.put('/recipes/:id', (req, res) => {
    const { name, description, money_cost, ingredients, result_type, result_id, success_chance, category_id } = req.body;
    db.prepare(
        'UPDATE craft_recipes SET name=?, description=?, money_cost=?, result_type=?, result_id=?, success_chance=?, category_id=? WHERE id=?'
    ).run(name, description, money_cost, result_type || '', result_id || 0, success_chance ?? 100, category_id || null, req.params.id);

    await db.prepareRun('DELETE FROM craft_recipe_ingredients WHERE recipe_id=?')(req.params.id);
    if (ingredients && Array.isArray(ingredients)) {
        const stmt = db.prepare('INSERT INTO craft_recipe_ingredients (recipe_id, craft_item_id, quantity) VALUES (?, ?, ?)');
        for (const ing of ingredients) {
            stmt.run(req.params.id, ing.craft_item_id, ing.quantity);
        }
    }
    res.json({ success: true });
});

router.delete('/recipes/:id', (req, res) => {
    await db.prepareRun('DELETE FROM craft_recipes WHERE id=?')(req.params.id);
    await db.prepareRun('DELETE FROM craft_recipe_ingredients WHERE recipe_id=?')(req.params.id);
    res.json({ success: true });
});

// ==================== Категории рецептов ====================
router.get('/recipe-categories', (req, res) => {
    const cats = await db.prepareAll('SELECT * FROM craft_recipe_categories ORDER BY sort_order, id')();
    res.json(cats);
});

router.post('/recipe-categories', (req, res) => {
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    await db.prepareRun('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)')(name, sort_order || 0);
    res.json({ success: true });
});

router.put('/recipe-categories/:id', (req, res) => {
    const { name, sort_order } = req.body;
    await db.prepareRun('UPDATE craft_recipe_categories SET name=?, sort_order=? WHERE id=?')(name, sort_order || 0, req.params.id);
    res.json({ success: true });
});

router.delete('/recipe-categories/:id', (req, res) => {
    await db.prepareRun('DELETE FROM craft_recipe_categories WHERE id=?')(req.params.id);
    res.json({ success: true });
});

// ==================== Шансы улучшения (upgrade_chances) ====================
router.get('/upgrade-chances', (req, res) => {
    const chances = await db.prepareAll('SELECT * FROM upgrade_chances ORDER BY rarity_id, level')();
    res.json(chances);
});

router.post('/upgrade-chances', (req, res) => {
    const { level, rarity_id, chance, money_cost } = req.body;
    if (level == null || chance == null || money_cost == null) return res.status(400).json({ error: 'level, chance, money_cost required' });
    const rId = rarity_id ?? 0;
    await db.prepareRun('INSERT OR REPLACE INTO upgrade_chances (level, rarity_id, chance, money_cost) VALUES (?, ?, ?, ?)')(level, rId, chance, money_cost);
    res.json({ success: true });
});

router.put('/upgrade-chances/:level/:rarity_id', (req, res) => {
    const { chance, money_cost } = req.body;
    await db.prepareRun('UPDATE upgrade_chances SET chance=?, money_cost=? WHERE level=? AND rarity_id=?')(chance, money_cost, req.params.level, req.params.rarity_id);
    res.json({ success: true });
});

router.delete('/upgrade-chances/:level/:rarity_id', (req, res) => {
    await db.prepareRun('DELETE FROM upgrade_chances WHERE level=? AND rarity_id=?')(req.params.level, req.params.rarity_id);
    res.json({ success: true });
});

export default router;