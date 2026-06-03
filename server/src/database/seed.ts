import type Database from 'better-sqlite3';

export function runSeed(db: InstanceType<typeof Database>) {
  // Начальные редкости
  const rarityCount = (db.prepare('SELECT COUNT(*) as cnt FROM rarities').get() as any).cnt;
  if (rarityCount === 0) {
    const insertRarity = db.prepare('INSERT INTO rarities (id, name, display_name, color) VALUES (?, ?, ?, ?)');
    insertRarity.run(0, 'junk', 'Хлам', '#888888');
    insertRarity.run(1, 'common', 'Обычный', '#cccccc');
    insertRarity.run(2, 'uncommon', 'Необычный', '#2ecc71');
    insertRarity.run(3, 'rare', 'Редкий', '#3498db');
    insertRarity.run(4, 'epic', 'Эпический', '#9b59b6');
    insertRarity.run(5, 'legendary', 'Легендарный', '#f1c40f');
    insertRarity.run(6, 'mythic', 'Мифический', '#e74c3c');
  }

  // Начальные предметы
  const itemCount = (db.prepare('SELECT COUNT(*) as cnt FROM items').get() as any).cnt;
  if (itemCount === 0) {
    const initialItems = [
      { name: 'Серый шлем', slot: 'helmet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 5, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 } },
      { name: 'Белый меч', slot: 'weapon1', rarity_id: 1, bonuses: { s: 10, a: 0, d: 0, m: 0 }, extra: { crit: 2, dodge: 0, counter: 0, fullBlock: 0 } },
      { name: 'Зелёное кольцо', slot: 'ring1', rarity_id: 2, bonuses: { s: 0, a: 15, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 } },
      { name: 'Синий амулет', slot: 'amulet', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 20 }, extra: { crit: 0, dodge: 5, counter: 0, fullBlock: 0 } },
      { name: 'Фиолетовые перчатки', slot: 'gloves', rarity_id: 4, bonuses: { s: 15, a: 0, d: 0, m: 0 }, extra: { crit: 5, dodge: 0, counter: 0, fullBlock: 0 } },
      { name: 'Жёлтый пояс', slot: 'belt', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 10, fullBlock: 0 } },
      { name: 'Красные ботинки', slot: 'boots', rarity_id: 6, bonuses: { s: 0, a: 30, d: 0, m: 0 }, extra: { crit: 0, dodge: 10, counter: 0, fullBlock: 5 } }
    ];
    const insert = db.prepare('INSERT INTO items (name, slot, rarity_id, bonuses, extra, image) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of initialItems) {
      insert.run(item.name, item.slot, item.rarity_id, JSON.stringify(item.bonuses), JSON.stringify(item.extra), null);
    }
  }

  // Начальные работы
  const jobCount = (db.prepare('SELECT COUNT(*) as cnt FROM jobs').get() as any).cnt;
  if (jobCount === 0) {
    const insertJob = db.prepare('INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)');
    insertJob.run('Помощь жителям', 'Помощь горожанам', 600, 0, 250);
    insertJob.run('Патруль городских стен', 'Обход стен', 1800, 100, 500);
    insertJob.run('Служба в карауле', 'Караул у ворот', 3600, 250, 1000);
    insertJob.run('Дальнее ополчение', 'Поход за границу', 28800, 1000, 8000);
  }

  // Начальные названия характеристик
  const statCount = (db.prepare('SELECT COUNT(*) as cnt FROM stat_names').get() as any).cnt;
  if (statCount === 0) {
    const insert = db.prepare('INSERT INTO stat_names (name, nameRu) VALUES (?, ?)');
    const stats = [
      ['s', 'Сила'], ['a', 'Ловкость'], ['d', 'Защита'], ['m', 'Мастерство'],
      ['crit', 'Крит'], ['dodge', 'Уклонение'], ['counter', 'Контрудар'],
      ['fullBlock', 'Полный блок'], ['block', 'Блок'],
    ];
    for (const [name, nameRu] of stats) insert.run(name, nameRu);
  }

  // Начальные ресурсы (материалы)
  const craftItemCount = (db.prepare('SELECT COUNT(*) as cnt FROM craft_items').get() as any).cnt;
  if (craftItemCount === 0) {
    const insertCraft = db.prepare('INSERT INTO craft_items (name, rarity_id, type, image) VALUES (?, ?, ?, ?)');
    const names = ['Серый материал', 'Белый материал', 'Зелёный материал', 'Синий материал', 'Фиолетовый материал', 'Жёлтый материал', 'Красный материал'];
    names.forEach((name, i) => insertCraft.run(name, i, 'craft', null));
  }

  // Начальные категории рецептов
  const catCount = (db.prepare('SELECT COUNT(*) as cnt FROM craft_recipe_categories').get() as any).cnt;
  if (catCount === 0) {
    db.prepare('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)').run('Материалы', 1);
    db.prepare('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)').run('Улучшения', 2);
  }

  // Начальные шансы улучшения
  const upgradeChanceCount = (db.prepare('SELECT COUNT(*) as cnt FROM upgrade_chances').get() as any).cnt;
  if (upgradeChanceCount === 0) {
    const insertUpgrade = db.prepare('INSERT OR REPLACE INTO upgrade_chances (level, chance, money_cost) VALUES (?, ?, ?)');
    insertUpgrade.run(1, 100, 250);
    insertUpgrade.run(2, 90, 500);
    insertUpgrade.run(3, 70, 1000);
    insertUpgrade.run(4, 50, 2000);
    insertUpgrade.run(5, 25, 4000);
    insertUpgrade.run(6, 10, 8000);
    insertUpgrade.run(7, 5, 16000);
  }
}
