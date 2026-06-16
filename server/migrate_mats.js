const { Pool } = require('pg');
const pool = new Pool({host:'localhost', user:'game', password:'game123', database:'game'});

(async() => {
  const updates = [
    ["Пыль забвения → Осколок скорби", 15, "15 Пыли забвения в 1 Осколок скорби"],
    ["Осколок скорби → Фрагмент ужаса", 15, "15 Осколков скорби в 1 Фрагмент ужаса"],
    ["Фрагмент ужаса → Эссенция мрака", 15, "15 Фрагментов ужаса в 1 Эссенцию мрака"],
    ["Эссенция мрака → Сердцевина бездны", 15, "15 Эссенций мрака в 1 Сердцевину бездны"],
    ["Сердцевина бездны → Искра погибели", 21, "21 Сердцевина бездны в 1 Искру погибели"],
    ["Искра погибели → Слеза вечности", 27, "27 Искр погибели в 1 Слезу вечности"],
  ];
  
  for (const [name, qty, desc] of updates) {
    // Update ingredient quantity
    const r = await pool.query(
      `UPDATE craft_recipe_ingredients SET quantity = $1
       WHERE recipe_id = (SELECT id FROM craft_recipes WHERE name = $2)`,
      [qty, name]
    );
    // Update description
    await pool.query(
      `UPDATE craft_recipes SET description = $1 WHERE name = $2`,
      [desc, name]
    );
    console.log(`${name}: qty→${qty}, desc updated (${r.rowCount} ingredients)`);
  }
  
  console.log('DONE');
  pool.end();
})();
