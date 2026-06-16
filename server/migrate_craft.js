const { Pool } = require('pg');
const pool = new Pool({host:'localhost', user:'game', password:'game123', database:'game'});

(async() => {
  // 1. Удалить рецепты камней улучшения (result_type='craft_item' + результат = камень улучшения)
  const deleted = await pool.query(
    `DELETE FROM craft_recipe_ingredients WHERE recipe_id IN (
       SELECT cr.id FROM craft_recipes cr
       JOIN craft_items ci ON cr.result_id = ci.id
       WHERE cr.result_type = 'craft_item' AND ci.type = 'upgrade'
     )`
  );
  console.log('deleted ingredients:', deleted.rowCount);

  const deleted2 = await pool.query(
    `DELETE FROM craft_recipes WHERE id IN (
       SELECT cr.id FROM craft_recipes cr
       JOIN craft_items ci ON cr.result_id = ci.id
       WHERE cr.result_type = 'craft_item' AND ci.type = 'upgrade'
     )`
  );
  console.log('deleted stone recipes:', deleted2.rowCount);

  // 2. Обновить цены на материалы (÷4)
  const updates = [
    ["Пыль забвения → Осколок скорби", 5],
    ["Осколок скорби → Фрагмент ужаса", 20],
    ["Фрагмент ужаса → Эссенция мрака", 75],
    ["Эссенция мрака → Сердцевина бездны", 250],
    ["Сердцевина бездны → Искра погибели", 875],
    ["Искра погибели → Слеза вечности", 3000],
  ];
  for (const [name, cost] of updates) {
    const r = await pool.query("UPDATE craft_recipes SET money_cost = $1 WHERE name = $2", [cost, name]);
    console.log(`updated ${name}: ${r.rowCount} rows → ${cost}`);
  }

  console.log('DONE');
  pool.end();
})();
