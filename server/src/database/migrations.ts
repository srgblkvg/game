import type Database from 'better-sqlite3';

export function runMigrations(db: InstanceType<typeof Database>) {
  // Блокировка аккаунта (failedLogins, lockedUntil)
  for (const col of [
    'failedLogins INTEGER DEFAULT 0',
    'lockedUntil INTEGER DEFAULT 0',
  ]) {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col}`); } catch { /* уже существует */ }
  }

  // Миграция старых материалов в инвентарях (material → craft_item)
  const usersWithMaterials = db.prepare('SELECT id, inventory FROM users WHERE inventory LIKE ?').all('%material%') as any[];
  if (usersWithMaterials.length > 0) {
    const getCraftItemByRarity = db.prepare('SELECT c.id, c.name, c.rarity_id, c.type, c.image, r.display_name, r.color FROM craft_items c JOIN rarities r ON c.rarity_id = r.id WHERE c.rarity_id = ?');
    const updateUser = db.prepare('UPDATE users SET inventory = ? WHERE id = ?');

    for (const user of usersWithMaterials) {
      let inventory = JSON.parse(user.inventory || '[]');
      let changed = false;

      inventory = inventory.map((item: any) => {
        if (item.type === 'material' && item.rarity !== undefined) {
          const craftItem = getCraftItemByRarity.get(item.rarity) as any;
          if (craftItem) {
            changed = true;
            const existingIndex = inventory.findIndex((i: any) => i.type === 'craft_item' && i.id === craftItem.id);
            if (existingIndex !== -1) {
              inventory[existingIndex].count = (inventory[existingIndex].count || 0) + (item.count || 1);
              return null;
            }
            return {
              type: 'craft_item',
              id: craftItem.id,
              name: craftItem.name,
              rarity_id: craftItem.rarity_id,
              rarity_display: craftItem.display_name,
              rarity_color: craftItem.color,
              count: item.count || 1,
              itemType: craftItem.type || 'craft',
              image: craftItem.image || null,
            };
          }
        }
        return item;
      }).filter(Boolean);

      if (changed) {
        updateUser.run(JSON.stringify(inventory), user.id);
      }
    }
  }

  // Базовые характеристики и очки статов
  try { db.exec('ALTER TABLE users ADD COLUMN statPoints INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseS INTEGER DEFAULT 5'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseA INTEGER DEFAULT 5'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseD INTEGER DEFAULT 5'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN baseM INTEGER DEFAULT 5'); } catch {}

  // Инициализация статов для существующих игроков (у кого NULL)
  db.exec(`UPDATE users SET baseS = 5, baseA = 5, baseD = 5, baseM = 5
    WHERE baseS IS NULL OR baseS = 0`);

  // Email верификация
  try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN emailVerified INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN emailCode TEXT'); } catch {}
  try { db.exec('ALTER TABLE users ADD COLUMN emailCodeExpires INTEGER DEFAULT 0'); } catch {}
}
