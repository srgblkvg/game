const { Pool } = require('pg');
const pool = new Pool({host:'localhost',user:'postgres',password:'postgres',database:'game'});
(async()=>{
  await pool.query('ALTER TABLE items ADD COLUMN IF NOT EXISTS sellable BOOLEAN DEFAULT false');
  console.log('sellable column added');
  
  // Re-seed items from the seed file
  const { seedItems } = require('./src/database/seed');
  if (typeof seedItems === 'function') {
    await seedItems();
    console.log('items re-seeded');
  } else {
    console.log('no seedItems export, need manual insert');
  }
  pool.end();
})();
