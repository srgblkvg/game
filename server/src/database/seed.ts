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

  // Мобы (PvE бестиарий)
  const mobCount = (db.prepare('SELECT COUNT(*) as cnt FROM mobs').get() as any).cnt;
  if (mobCount === 0) {
    const insertMob = db.prepare(`INSERT INTO mobs (name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max,
      loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    const mobs = [
      // Уровни 1-5 (Склеп)
      ['Костяная крыса', 1, 8, 3, 2, 1, 0, 0, 1, 2, 0.8, 0.2, 0, 0, 0, 0, 0, 'Склеп'],
      ['Блуждающий череп', 1, 10, 2, 1, 2, 1, 0, 1, 3, 0.75, 0.25, 0, 0, 0, 0, 0, 'Склеп'],
      ['Слизень склепа', 2, 14, 4, 1, 2, 0, 1, 1, 3, 0.7, 0.3, 0, 0, 0, 0, 0, 'Склеп'],
      ['Плакальщик', 3, 18, 5, 3, 2, 1, 1, 1, 3, 0.6, 0.35, 0.05, 0, 0, 0, 0, 'Подземелье'],
      ['Гнилой страж', 4, 22, 6, 3, 3, 1, 1, 2, 4, 0.5, 0.4, 0.1, 0, 0, 0, 0, 'Подземелье'],
      ['Упырь-послушник', 5, 28, 7, 4, 3, 2, 2, 2, 5, 0.45, 0.4, 0.15, 0, 0, 0, 0, 'Подземелье'],
      // Уровни 6-15
      ['Пепельный бродяга', 6, 35, 9, 5, 4, 2, 1, 2, 5, 0.4, 0.4, 0.2, 0, 0, 0, 0, 'Катакомбы'],
      ['Костяной пёс', 8, 45, 12, 7, 5, 3, 1, 3, 7, 0.3, 0.4, 0.25, 0.05, 0, 0, 0, 'Катакомбы'],
      ['Шепчущий мертвец', 10, 55, 14, 8, 7, 4, 2, 3, 8, 0, 0.4, 0.35, 0.2, 0.05, 0, 0, 'Деревня Пепла'],
      ['Вдова Леса Черепов', 12, 70, 17, 10, 9, 5, 2, 4, 10, 0, 0.35, 0.35, 0.25, 0.05, 0, 0, 'Лес Черепов'],
      ['Гниющий рыцарь', 14, 85, 20, 11, 12, 6, 2, 5, 12, 0, 0.3, 0.3, 0.3, 0.1, 0, 0, 'Лес Черепов'],
      // Уровни 16-30
      ['Ядовитый ползун', 16, 100, 24, 13, 14, 7, 1, 5, 12, 0, 0.35, 0.4, 0.2, 0.05, 0, 0, 'Старый Тракт'],
      ['Призрак тракта', 18, 115, 27, 16, 15, 8, 1, 6, 15, 0, 0.3, 0.4, 0.25, 0.05, 0, 0, 'Старый Тракт'],
      ['Паук-костолом', 20, 130, 30, 18, 18, 9, 2, 8, 18, 0, 0.25, 0.4, 0.25, 0.1, 0, 0, 'Ядовитые луга'],
      ['Еретик-отступник', 23, 155, 35, 20, 22, 11, 2, 10, 22, 0, 0, 0.4, 0.35, 0.2, 0.05, 0, 'Первый ярус'],
      ['Палач катакомб', 26, 180, 40, 22, 26, 13, 2, 12, 28, 0, 0, 0.35, 0.35, 0.25, 0.05, 0, 'Первый ярус'],
      ['Кошмарный схимник', 29, 210, 46, 25, 30, 15, 2, 15, 35, 0, 0, 0.3, 0.35, 0.25, 0.1, 0, 'Первый ярус'],
      // Уровни 31-50
      ['Утопленник топи', 32, 240, 52, 28, 34, 17, 1, 18, 40, 0, 0, 0.25, 0.4, 0.25, 0.1, 0, 'Гнилая Топь'],
      ['Монастырский страж', 36, 280, 60, 32, 40, 20, 1, 22, 50, 0, 0, 0, 0.4, 0.35, 0.2, 0.05, 'Чёрный Монастырь'],
      ['Колокольный звонарь', 40, 320, 68, 35, 46, 23, 2, 30, 65, 0, 0, 0, 0.35, 0.4, 0.2, 0.05, 'Чёрный Монастырь'],
      ['Плакальщица башни', 44, 370, 78, 38, 54, 27, 2, 38, 80, 0, 0, 0, 0.3, 0.4, 0.25, 0.05, 'Башня Плакальщиц'],
      ['Рыцарь ордена Скорби', 48, 420, 88, 42, 62, 31, 2, 48, 100, 0, 0, 0, 0.25, 0.4, 0.3, 0.05, 'Башня Плакальщиц'],
      // Уровни 51-75
      ['Королевский страж', 53, 480, 100, 48, 72, 36, 1, 55, 120, 0, 0, 0, 0, 0.45, 0.35, 0.2, 'Некрополь Королей'],
      ['Древний лич', 58, 550, 112, 52, 84, 42, 1, 70, 150, 0, 0, 0, 0, 0.4, 0.4, 0.2, 'Некрополь Королей'],
      ['Костяной король', 64, 630, 128, 58, 98, 49, 2, 90, 190, 0, 0, 0, 0, 0.35, 0.45, 0.2, 'Некрополь Королей'],
      ['Бездонный ужас', 70, 720, 146, 64, 112, 56, 2, 110, 240, 0, 0, 0, 0, 0.3, 0.5, 0.2, 'Бездонный Овраг'],
      // Уровни 76-100
      ['Архидемон бездны', 78, 840, 168, 72, 130, 65, 1, 150, 320, 0, 0, 0, 0, 0, 0.6, 0.4, 'Врата Бездны'],
      ['Ткач судеб', 86, 1000, 196, 80, 156, 78, 1, 200, 420, 0, 0, 0, 0, 0, 0.5, 0.5, 'Врата Бездны'],
      ['Глас пустоты', 94, 1180, 226, 90, 184, 92, 2, 280, 560, 0, 0, 0, 0, 0, 0.4, 0.6, 'Врата Бездны'],
      ['Смерть', 100, 1400, 260, 100, 220, 110, 2, 400, 800, 0, 0, 0, 0, 0, 0.3, 0.7, 'Врата Бездны'],
    ];

    for (const m of mobs) insertMob.run(...m);
  }
}
