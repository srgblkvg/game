// Компенсация: довернуть Топаз и Аметист тем кто купил ruby_rune до переделки
// Запуск: cd /opt/game/server && node compensate_runes.js

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

const RUNE_ITEMS = ['ruby_rune_1', 'ruby_rune_3', 'ruby_rune_5'];
// Сколько каждого вида рун в одном паке
const COUNT_MAP = { ruby_rune_1: 1, ruby_rune_3: 3, ruby_rune_5: 5 };

async function main() {
  const client = await pool.connect();
  try {
    console.log('Собираем покупки рубиновых рун...');

    const { rows: payments } = await client.query(`
      SELECT character_id as user_id, item, COUNT(*) as cnt
      FROM vk_payments
      WHERE character_id > 0 AND item = ANY($1)
      GROUP BY character_id, item
      UNION ALL
      SELECT user_id, item, COUNT(*) as cnt
      FROM yukassa_payments
      WHERE status = 'succeeded' AND item = ANY($1)
      GROUP BY user_id, item
    `, [RUNE_ITEMS]);

    console.log(`Найдено ${payments.length} записей`);
    if (payments.length === 0) { console.log('Нечего компенсировать.'); return; }

    // Суммируем общее количество рун на пользователя
    const userRuneCounts = {};
    for (const p of payments) {
      const uid = p.user_id;
      const perPack = COUNT_MAP[p.item] || 1;
      if (!userRuneCounts[uid]) userRuneCounts[uid] = 0;
      userRuneCounts[uid] += perPack * p.cnt;
    }

    console.log(`Пользователей: ${Object.keys(userRuneCounts).length}`);

    // Загружаем Топаз и Аметист из БД
    const runeCache = {};
    for (const name of ['Руна Топаза', 'Руна Аметиста']) {
      const { rows } = await client.query(
        `SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name as rarity_display, r.color as rarity_color
         FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.name = $1`, [name]
      );
      if (rows[0]) runeCache[name] = rows[0];
    }

    if (Object.keys(runeCache).length === 0) {
      console.log('Руны не найдены в БД!');
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    let totalUsers = 0;

    for (const [uid, count] of Object.entries(userRuneCounts)) {
      try {
        await client.query('BEGIN');

        const userRow = await client.query('SELECT inventory FROM users WHERE id = $1', [uid]);
        const inventory = JSON.parse(userRow.rows[0]?.inventory || '[]');

        const addStack = (itemData, qty) => {
          const existing = inventory.find(i =>
            (i.type === 'craft_item' || i.type === 'material') && i.id === itemData.id
          );
          if (existing) { existing.count = (existing.count || 0) + qty; }
          else {
            inventory.push({
              type: 'craft_item', id: itemData.id, name: itemData.name,
              rarity_id: itemData.rarity_id, rarity_display: itemData.rarity_display,
              rarity_color: itemData.rarity_color, count: qty,
              itemType: itemData.type || 'upgrade', image: itemData.image || null,
            });
          }
        };

        for (const rune of Object.values(runeCache)) {
          addStack(rune, count);
        }

        await client.query('UPDATE users SET inventory = $1 WHERE id = $2', [JSON.stringify(inventory), uid]);

        // Сообщение в личку
        const msg = `⚖️ Довыдача рун за наборы «Руна Рубина». В каждый набор теперь входят Руна Топаза (+30%) и Руна Аметиста (+20%).\n\nПолучено дополнительно: Руна Топаза ×${count}, Руна Аметиста ×${count}.\n\nСпасибо за поддержку игры!`;
        await client.query(
          'INSERT INTO chat_messages (senderId, targetId, content) VALUES (0, $1, $2)',
          [uid, msg]
        );

        await client.query('COMMIT');
        console.log(`#${uid}: +${count} Топазов +${count} Аметистов`);
        totalUsers++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`❌ #${uid}: ${err.message}`);
      }
    }

    console.log(`\nГотово! ${totalUsers} пользователей получили руны.`);
  } catch (err) {
    console.error('Ошибка:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
