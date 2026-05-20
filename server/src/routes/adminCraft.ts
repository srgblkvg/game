import { Router } from 'express';
import db from '../database';

const router = Router();

// ==================== Ресурсы (craft_items) ====================
router.get('/craft-items', (req, res) => {
    const items = db.prepare('SELECT * FROM craft_items ORDER BY id').all();
    res.json(items);
});

router.post('/craft-items', (req, res) => {
    const { name, rarity, description, type, image } = req.body;
    if (!name || rarity === undefined) return res.status(400).json({ error: 'name, rarity required' });
    db.prepare('INSERT INTO craft_items (name, rarity, description, type, image) VALUES (?, ?, ?, ?, ?)')
        .run(name, rarity, description || '', type || 'craft', image || null);
    res.json({ success: true });
});

router.put('/craft-items/:id', (req, res) => {
    const { name, rarity, description, type, image } = req.body;
    db.prepare('UPDATE craft_items SET name=?, rarity=?, description=?, type=?, image=? WHERE id=?')
        .run(name, rarity, description, type || 'craft', image || null, req.params.id);
    res.json({ success: true });
});

router.delete('/craft-items/:id', (req, res) => {
    db.prepare('DELETE FROM craft_items WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ==================== Рецепты (craft_recipes) ====================
router.get('/recipes', (req, res) => {
    const recipes = db.prepare('SELECT * FROM craft_recipes ORDER BY id').all() as any[];
    for (const recipe of recipes) {
        recipe.ingredients = db.prepare(`
      SELECT ci.id, ci.name, ci.rarity, ci.type as itemType, ci.image, cri.quantity
      FROM craft_recipe_ingredients cri
      JOIN craft_items ci ON ci.id = cri.craft_item_id
      WHERE cri.recipe_id = ?
    `).all(recipe.id);

        if (recipe.result_type === 'item') {
            recipe.result = db.prepare('SELECT id, name, slot, rarity, image FROM items WHERE id = ?').get(recipe.result_id) || null;
        } else if (recipe.result_type === 'craft_item') {
            recipe.result = db.prepare('SELECT id, name, rarity, image FROM craft_items WHERE id = ?').get(recipe.result_id) || null;
        } else {
            recipe.result = null;
        }

        recipe.category = db.prepare('SELECT * FROM craft_recipe_categories WHERE id = ?').get(recipe.category_id) || null;
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

    db.prepare('DELETE FROM craft_recipe_ingredients WHERE recipe_id=?').run(req.params.id);
    if (ingredients && Array.isArray(ingredients)) {
        const stmt = db.prepare('INSERT INTO craft_recipe_ingredients (recipe_id, craft_item_id, quantity) VALUES (?, ?, ?)');
        for (const ing of ingredients) {
            stmt.run(req.params.id, ing.craft_item_id, ing.quantity);
        }
    }
    res.json({ success: true });
});

router.delete('/recipes/:id', (req, res) => {
    db.prepare('DELETE FROM craft_recipes WHERE id=?').run(req.params.id);
    db.prepare('DELETE FROM craft_recipe_ingredients WHERE recipe_id=?').run(req.params.id);
    res.json({ success: true });
});

// ==================== Категории рецептов ====================
router.get('/recipe-categories', (req, res) => {
    const cats = db.prepare('SELECT * FROM craft_recipe_categories ORDER BY sort_order, id').all();
    res.json(cats);
});

router.post('/recipe-categories', (req, res) => {
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    db.prepare('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)').run(name, sort_order || 0);
    res.json({ success: true });
});

router.put('/recipe-categories/:id', (req, res) => {
    const { name, sort_order } = req.body;
    db.prepare('UPDATE craft_recipe_categories SET name=?, sort_order=? WHERE id=?').run(name, sort_order || 0, req.params.id);
    res.json({ success: true });
});

router.delete('/recipe-categories/:id', (req, res) => {
    db.prepare('DELETE FROM craft_recipe_categories WHERE id=?').run(req.params.id);
    res.json({ success: true });
});

// ==================== Шансы улучшения (upgrade_chances) ====================
router.get('/upgrade-chances', (req, res) => {
    const chances = db.prepare('SELECT * FROM upgrade_chances ORDER BY level').all();
    res.json(chances);
});

router.post('/upgrade-chances', (req, res) => {
    const { level, chance, money_cost } = req.body;
    if (level == null || chance == null || money_cost == null) return res.status(400).json({ error: 'level, chance, money_cost required' });
    db.prepare('INSERT OR REPLACE INTO upgrade_chances (level, chance, money_cost) VALUES (?, ?, ?)').run(level, chance, money_cost);
    res.json({ success: true });
});

router.put('/upgrade-chances/:level', (req, res) => {
    const { chance, money_cost } = req.body;
    db.prepare('UPDATE upgrade_chances SET chance=?, money_cost=? WHERE level=?').run(chance, money_cost, req.params.level);
    res.json({ success: true });
});

router.delete('/upgrade-chances/:level', (req, res) => {
    db.prepare('DELETE FROM upgrade_chances WHERE level=?').run(req.params.level);
    res.json({ success: true });
});

export default router;