// Компенсация донатерам после ×10 ребаланса серебра и предметов
// Запуск: cd /opt/game/server && node compensate_donate.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'game',
  user: process.env.PGUSER || 'game',
  password: process.env.PGPASSWORD || 'game123',
  max: 1,
});

const ALL_SLOTS = ['weapon1', 'shield', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring', 'belt'];

const COMPENSATION = {
  silver_1000:   { money: 9000 },
  silver_5000:   { money: 45000 },
  silver_10000:  { money: 90000 },
  silver_50000:  { money: 450000 },
  silver_100000: { money: 900000 },
  silver_1000000:{ money: 0 },
  starter_pack: { money: 9000, starterItems: true, material: 'Эссенция мрака', matQty: 4 },
  craft_rare: { money: 9000, material: 'Сердцевина бездны', matQty: 2, stone: 'Камень улучшения (Хлам)', stoneQty: 3 },
  craft_epic: { money: 27000, material: 'Искра погибели', matQty: 2, stone: 'Камень улучшения (Хлам)', stoneQty: 5 },
};

async function main() {
  const client = await pool.connect();
  try {
    console.log('🔍 Собираем данные платежей...');
    
    const { rows: payments } = await client.query(`
      SELECT character_id as user_id, item, COUNT(*) as cnt
      FROM vk_payments
      WHERE character_id > 0 AND item = ANY($1)
      GROUP BY character_id, item
    `, [Object.keys(COMPENSATION)]);
    
    console.log(`📊 Найдено ${payments.length} записей о платежах`);
    
    if (payments.length === 0) {
      console.log('✅ Нечего компенсировать.');
      return;
    }
    
    const userComps = {};
    
    for (const p of payments) {
      const comp = COMPENSATION[p.item];
      if (!comp) continue;
      
      const uid = p.user_id;
      if (!userComps[uid]) {
        userComps[uid] = { money: 0, starterCnt: 0, materials: [], craftItems: [] };
      }
      
      userComps[uid].money += (comp.money || 0) * p.cnt;
      if (comp.starterItems) userComps[uid].starterCnt += p.cnt;
      if (comp.material) userComps[uid].materials.push({ name: comp.material, qty: comp.matQty * p.cnt });
      if (comp.stone) userComps[uid].craftItems.push({ name: comp.stone, qty: comp.stoneQty * p.cnt });
    }
    
    // Объединяем материалы
    for (const uid of Object.keys(userComps)) {
      const u = userComps[uid];
      const merge = (arr) => {
        const m = {};
        for (const { name, qty } of arr) m[name] = (m[name] || 0) + qty;
        return Object.entries(m).map(([name, qty]) => ({ name, qty }));
      };
      u.materials = merge(u.materials);
      u.craftItems = merge(u.craftItems);
    }
    
    console.log(`👤 Пользователей: ${Object.keys(userComps).length}`);
    
    // Загружаем необычный сет
    console.log('📦 Загружаем предметы...');
    const starterItems = [];
    for (const slot of ALL_SLOTS) {
      const { rows } = await client.query(
        'SELECT id, name, slot, rarity_id, bonuses, extra, image FROM items WHERE rarity_id = 2 AND slot = $1 ORDER BY id LIMIT 1',
        [slot]
      );
      if (rows[0]) starterItems.push(rows[0]);
    }
    console.log(`  Необычный сет: ${starterItems.length} предметов`);
    
    // Загружаем материалы
    const materialCache = {};
    const allMatNames = new Set();
    for (const u of Object.values(userComps)) {
      for (const m of u.materials) allMatNames.add(m.name);
      for (const m of u.craftItems) allMatNames.add(m.name);
    }
    
    for (const name of allMatNames) {
      const { rows } = await client.query(
        `SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color
         FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = $1`,
        [name]
      );
      if (rows[0]) materialCache[name] = rows[0];
    }
    
    // Применяем
    console.log('\n💸 Компенсация...');
    const now = Math.floor(Date.now() / 1000);
    let totalMoney = 0, totalUsers = 0;
    
    for (const [uid, comp] of Object.entries(userComps)) {
      try {
        await client.query('BEGIN');
        
        // Серебро
        if (comp.money > 0) {
          await client.query('UPDATE users SET money = money + $1 WHERE id = $2', [comp.money, uid]);
          console.log(`  #${uid}: 💰 +${comp.money.toLocaleString()}`);
        }
        
        // Стартовый набор: предметы на склад
        if (comp.starterCnt > 0) {
          for (let i = 0; i < comp.starterCnt; i++) {
            for (const item of starterItems) {
              const invItem = {
                id: Date.now() + Math.random(),
                name: item.name,
                slot: item.slot,
                rarity_id: item.rarity_id,
                bonuses: item.bonuses || {},
                extra: item.extra || {},
                image: item.image || null,
              };
              await client.query(
                'INSERT INTO overflow_storage (userid, item, createdat) VALUES ($1, $2, $3)',
                [uid, JSON.stringify(invItem), now]
              );
            }
          }
          console.log(`  #${uid}: 📦 ${comp.starterCnt}× необычный сет → склад`);
        }
        
        // Материалы в инвентарь
        const userRow = await client.query('SELECT inventory, username FROM users WHERE id = $1', [uid]);
        const inventory = JSON.parse(userRow.rows[0]?.inventory || '[]');
        const username = userRow.rows[0]?.username || `#${uid}`;
        
        const addStack = (itemData, qty) => {
          const existing = inventory.find(i =>
            (i.type === 'craft_item' || i.type === 'material') && i.id === itemData.id
          );
          if (existing) {
            existing.count = (existing.count || 0) + qty;
          } else {
            inventory.push({
              type: 'craft_item',
              id: itemData.id,
              name: itemData.name,
              rarity_id: itemData.rarity_id,
              rarity_display: itemData.rarity_display,
              rarity_color: itemData.rarity_color,
              count: qty,
              itemType: itemData.type || 'craft',
              image: itemData.image || null,
            });
          }
        };
        
        const matSummary = [];
        for (const m of comp.materials) {
          const mat = materialCache[m.name];
          if (mat) {
            addStack(mat, m.qty);
            matSummary.push(`${m.name} ×${m.qty}`);
          }
        }
        for (const m of comp.craftItems) {
          const mat = materialCache[m.name];
          if (mat) {
            addStack(mat, m.qty);
            matSummary.push(`${m.name} ×${m.qty}`);
          }
        }
        
        await client.query('UPDATE users SET inventory = $1 WHERE id = $2', [JSON.stringify(inventory), uid]);
        if (matSummary.length > 0) console.log(`  #${uid}: 🔮 ${matSummary.join(', ')}`);
        
        // Сообщение в личку от system
        const parts = [];
        if (comp.money > 0) parts.push(`${comp.money.toLocaleString()} серебра`);
        if (comp.starterCnt > 0) parts.push(`необычный сет ×${comp.starterCnt} (на складе)`);
        if (matSummary.length > 0) parts.push(matSummary.join(', '));
        
        const msg = `⚖️ Компенсация за ребаланс донат-товаров.\n\nПолучено: ${parts.join('; ')}.\n\nСпасибо за поддержку игры!`;
        
        await client.query(
          'INSERT INTO chat_messages (senderId, targetId, content) VALUES (0, $1, $2)',
          [uid, msg]
        );
        console.log(`  #${uid}: ✉️ сообщение в личку`);
        
        await client.query('COMMIT');
        totalMoney += comp.money;
        totalUsers++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌ #${uid}: ${err.message}`);
      }
    }
    
    console.log(`\n✅ Готово! ${totalUsers} пользователей, ${totalMoney.toLocaleString()}💰`);
    
  } catch (err) {
    console.error('❌ Ошибка:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
