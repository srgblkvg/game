import { db, pool } from '../db/index';

export async function runSeed() {
  // Начальные редкости
  const rarityCount = (await db.one('SELECT COUNT(*) as cnt FROM rarities') as any).cnt;
  if (rarityCount === 0) {
    const INSERT_RARITY = 'INSERT INTO rarities (id, name, display_name, color) VALUES (?, ?, ?, ?)';
    await db.run(INSERT_RARITY, [0, 'junk', 'Хлам', '#888888']);
    await db.run(INSERT_RARITY, [1, 'common', 'Обычный', '#cccccc']);
    await db.run(INSERT_RARITY, [2, 'uncommon', 'Необычный', '#2ecc71']);
    await db.run(INSERT_RARITY, [3, 'rare', 'Редкий', '#3498db']);
    await db.run(INSERT_RARITY, [4, 'epic', 'Эпический', '#9b59b6']);
    await db.run(INSERT_RARITY, [5, 'legendary', 'Легендарный', '#f1c40f']);
    await db.run(INSERT_RARITY, [6, 'mythic', 'Мифический', '#e74c3c']);
  }

  // Начальные предметы (189 предметов — по 21 на каждый слот)
  const itemCount = (await db.one('SELECT COUNT(*) as cnt FROM items') as any).cnt;
  if (itemCount === 0) {
    const INSERT_ITEM =
      'INSERT INTO items (name, slot, rarity_id, bonuses, extra, image, cost) VALUES (?, ?, ?, ?, ?, ?, ?)';

    const allItems: Array<{
      name: string;
      slot: string;
      rarity_id: number;
      bonuses: { s: number; a: number; d: number; m: number };
      extra: { crit: number; dodge: number; counter: number; fullBlock: number };
      cost: number;
    }> = [
      // ─── 🪖 Шлемы (Helmets) — 21 предмет ───
      { name: 'Скорбный капюшон', slot: 'helmet', rarity_id: 0, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 10 },
      { name: 'Гнилостный саллет', slot: 'helmet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 1, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8 },
      { name: 'Могильный череп', slot: 'helmet', rarity_id: 0, bonuses: { s: 0, a: 1, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 12 },
      { name: 'Кровавая маска', slot: 'helmet', rarity_id: 1, bonuses: { s: 2, a: 0, d: 0, m: 3 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 40 },
      { name: 'Катакомбный бацинет', slot: 'helmet', rarity_id: 1, bonuses: { s: 0, a: 3, d: 2, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Истлевший капюшон', slot: 'helmet', rarity_id: 1, bonuses: { s: 0, a: 0, d: 3, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 30 },
      { name: 'Призрачный венец', slot: 'helmet', rarity_id: 2, bonuses: { s: 5, a: 0, d: 0, m: 4 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 120 },
      { name: 'Проклятый клобук', slot: 'helmet', rarity_id: 2, bonuses: { s: 0, a: 6, d: 4, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 100 },
      { name: 'Шепчущий шлем', slot: 'helmet', rarity_id: 2, bonuses: { s: 0, a: 0, d: 5, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 110 },
      { name: 'Плакальщицы бацинет', slot: 'helmet', rarity_id: 3, bonuses: { s: 8, a: 0, d: 6, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 280 },
      { name: 'Ритуальная маска', slot: 'helmet', rarity_id: 3, bonuses: { s: 0, a: 9, d: 0, m: 7 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 300 },
      { name: 'Костяная корона', slot: 'helmet', rarity_id: 3, bonuses: { s: 7, a: 0, d: 0, m: 8 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Погребальный венец', slot: 'helmet', rarity_id: 4, bonuses: { s: 12, a: 0, d: 10, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 700 },
      { name: 'Черепная диадема', slot: 'helmet', rarity_id: 4, bonuses: { s: 0, a: 13, d: 0, m: 11 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 750 },
      { name: 'Мертвенный наголовник', slot: 'helmet', rarity_id: 4, bonuses: { s: 11, a: 9, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 800 },
      { name: 'Висельника корона', slot: 'helmet', rarity_id: 5, bonuses: { s: 18, a: 0, d: 15, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2200 },
      { name: 'Безымянный капюшон', slot: 'helmet', rarity_id: 5, bonuses: { s: 0, a: 19, d: 0, m: 14 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2400 },
      { name: 'Криптовый шлем', slot: 'helmet', rarity_id: 5, bonuses: { s: 16, a: 14, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2600 },
      { name: 'Жертвенный венец', slot: 'helmet', rarity_id: 6, bonuses: { s: 25, a: 0, d: 20, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7000 },
      { name: 'Утопленника маска', slot: 'helmet', rarity_id: 6, bonuses: { s: 0, a: 26, d: 0, m: 22 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7500 },
      { name: 'Пепельная корона', slot: 'helmet', rarity_id: 6, bonuses: { s: 23, a: 19, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8000 },

      // ─── 🛡️ Нагрудники (Chest) — 21 предмет ───
      { name: 'Скорлупный доспех', slot: 'chest', rarity_id: 0, bonuses: { s: 0, a: 0, d: 1, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 10 },
      { name: 'Выпотрошенная кольчуга', slot: 'chest', rarity_id: 0, bonuses: { s: 0, a: 0, d: 2, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 12 },
      { name: 'Гробовой панцирь', slot: 'chest', rarity_id: 0, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8 },
      { name: 'Рёберный нагрудник', slot: 'chest', rarity_id: 1, bonuses: { s: 0, a: 0, d: 3, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Хитиновая кираса', slot: 'chest', rarity_id: 1, bonuses: { s: 0, a: 3, d: 2, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 40 },
      { name: 'Кандальная бригантина', slot: 'chest', rarity_id: 1, bonuses: { s: 0, a: 0, d: 2, m: 2 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 45 },
      { name: 'Саркофаговый латник', slot: 'chest', rarity_id: 2, bonuses: { s: 0, a: 0, d: 6, m: 4 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 130 },
      { name: 'Плащаничное облачение', slot: 'chest', rarity_id: 2, bonuses: { s: 0, a: 5, d: 5, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 120 },
      { name: 'Эшафотный панцирь', slot: 'chest', rarity_id: 2, bonuses: { s: 6, a: 0, d: 4, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 140 },
      { name: 'Заупокойная кираса', slot: 'chest', rarity_id: 3, bonuses: { s: 0, a: 0, d: 8, m: 7 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 350 },
      { name: 'Крематорный нагрудник', slot: 'chest', rarity_id: 3, bonuses: { s: 9, a: 0, d: 6, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Некропольный доспех', slot: 'chest', rarity_id: 3, bonuses: { s: 0, a: 8, d: 7, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 360 },
      { name: 'Склепный панцирь', slot: 'chest', rarity_id: 4, bonuses: { s: 13, a: 0, d: 11, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 800 },
      { name: 'Удавленничий латник', slot: 'chest', rarity_id: 4, bonuses: { s: 0, a: 12, d: 10, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 750 },
      { name: 'Братской могилы экзоскелет', slot: 'chest', rarity_id: 4, bonuses: { s: 11, a: 0, d: 0, m: 12 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 850 },
      { name: 'Забальзамированная кираса', slot: 'chest', rarity_id: 5, bonuses: { s: 18, a: 0, d: 16, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2500 },
      { name: 'Исповедальный доспех', slot: 'chest', rarity_id: 5, bonuses: { s: 0, a: 20, d: 15, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2700 },
      { name: 'Скальпированный панцирь', slot: 'chest', rarity_id: 5, bonuses: { s: 17, a: 0, d: 0, m: 16 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2800 },
      { name: 'Саркофаговый экзоскелет', slot: 'chest', rarity_id: 6, bonuses: { s: 26, a: 0, d: 22, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7500 },
      { name: 'Крематорная кираса', slot: 'chest', rarity_id: 6, bonuses: { s: 24, a: 20, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8000 },
      { name: 'Эшафотное облачение', slot: 'chest', rarity_id: 6, bonuses: { s: 0, a: 25, d: 21, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7800 },

      // ─── 🧤 Перчатки (Gloves) — 21 предмет ───
      { name: 'Отсечённые пальчатки', slot: 'gloves', rarity_id: 0, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8 },
      { name: 'Мумифицированные рукавицы', slot: 'gloves', rarity_id: 0, bonuses: { s: 0, a: 0, d: 1, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 10 },
      { name: 'Костяшковые захваты', slot: 'gloves', rarity_id: 0, bonuses: { s: 0, a: 1, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7 },
      { name: 'Жильные перчатки', slot: 'gloves', rarity_id: 1, bonuses: { s: 3, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 30 },
      { name: 'Фаланговые латы', slot: 'gloves', rarity_id: 1, bonuses: { s: 0, a: 2, d: 2, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Ладонные рукавицы', slot: 'gloves', rarity_id: 1, bonuses: { s: 0, a: 0, d: 3, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 32 },
      { name: 'Когтистые боевые рукавицы', slot: 'gloves', rarity_id: 2, bonuses: { s: 5, a: 4, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 110 },
      { name: 'Суставчатые когти', slot: 'gloves', rarity_id: 2, bonuses: { s: 0, a: 6, d: 0, m: 3 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 120 },
      { name: 'Щупальцевые захваты', slot: 'gloves', rarity_id: 2, bonuses: { s: 4, a: 0, d: 5, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 115 },
      { name: 'Крючковатые перчатки', slot: 'gloves', rarity_id: 3, bonuses: { s: 8, a: 0, d: 0, m: 6 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 300 },
      { name: 'Хваткие латы', slot: 'gloves', rarity_id: 3, bonuses: { s: 0, a: 9, d: 6, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 310 },
      { name: 'Десничные кистени', slot: 'gloves', rarity_id: 3, bonuses: { s: 7, a: 7, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Пальцы мертвеца', slot: 'gloves', rarity_id: 4, bonuses: { s: 13, a: 0, d: 10, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 720 },
      { name: 'Сведённые рукавицы', slot: 'gloves', rarity_id: 4, bonuses: { s: 0, a: 12, d: 0, m: 11 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 750 },
      { name: 'Ногтевые сжиматели', slot: 'gloves', rarity_id: 4, bonuses: { s: 10, a: 10, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 700 },
      { name: 'Фаланговые когти', slot: 'gloves', rarity_id: 5, bonuses: { s: 19, a: 0, d: 14, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2300 },
      { name: 'Ладонные боевые рукавицы', slot: 'gloves', rarity_id: 5, bonuses: { s: 0, a: 18, d: 0, m: 16 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2400 },
      { name: 'Костяшковые латы', slot: 'gloves', rarity_id: 5, bonuses: { s: 16, a: 15, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2500 },
      { name: 'Пальцы мертвеца культяпки', slot: 'gloves', rarity_id: 6, bonuses: { s: 26, a: 20, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7200 },
      { name: 'Щупальцевые захваты', slot: 'gloves', rarity_id: 6, bonuses: { s: 0, a: 27, d: 0, m: 21 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7500 },
      { name: 'Хваткие когти', slot: 'gloves', rarity_id: 6, bonuses: { s: 23, a: 0, d: 22, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7800 },

      // ─── 🥾 Ботинки (Boots) — 21 предмет ───
      { name: 'Стоптанные обмотки', slot: 'boots', rarity_id: 0, bonuses: { s: 0, a: 1, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 9 },
      { name: 'Могильные башмаки', slot: 'boots', rarity_id: 0, bonuses: { s: 0, a: 0, d: 1, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7 },
      { name: 'Бродяжьи ступни', slot: 'boots', rarity_id: 0, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8 },
      { name: 'Костяные сапоги', slot: 'boots', rarity_id: 1, bonuses: { s: 0, a: 3, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 30 },
      { name: 'Погребённые поножи', slot: 'boots', rarity_id: 1, bonuses: { s: 0, a: 0, d: 3, m: 2 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Шагающие лапы', slot: 'boots', rarity_id: 1, bonuses: { s: 2, a: 2, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 32 },
      { name: 'Болотные ботфорты', slot: 'boots', rarity_id: 2, bonuses: { s: 0, a: 6, d: 0, m: 4 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 120 },
      { name: 'Заледенелые котурны', slot: 'boots', rarity_id: 2, bonuses: { s: 5, a: 4, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 110 },
      { name: 'Теневые сапоги', slot: 'boots', rarity_id: 2, bonuses: { s: 0, a: 5, d: 4, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 115 },
      { name: 'Окаменелые поножи', slot: 'boots', rarity_id: 3, bonuses: { s: 0, a: 8, d: 6, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 300 },
      { name: 'Пустотные башмаки', slot: 'boots', rarity_id: 3, bonuses: { s: 7, a: 7, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Бездонные ступни', slot: 'boots', rarity_id: 3, bonuses: { s: 0, a: 9, d: 0, m: 7 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 310 },
      { name: 'Копытные сапоги', slot: 'boots', rarity_id: 4, bonuses: { s: 12, a: 11, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 750 },
      { name: 'Трясинные ботфорты', slot: 'boots', rarity_id: 4, bonuses: { s: 0, a: 14, d: 0, m: 10 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 720 },
      { name: 'Скитальческие лапы', slot: 'boots', rarity_id: 4, bonuses: { s: 11, a: 0, d: 10, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 700 },
      { name: 'Могильные котурны', slot: 'boots', rarity_id: 5, bonuses: { s: 18, a: 16, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2300 },
      { name: 'Шагающие поножи', slot: 'boots', rarity_id: 5, bonuses: { s: 0, a: 20, d: 0, m: 15 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2500 },
      { name: 'Заледенелые ступни', slot: 'boots', rarity_id: 5, bonuses: { s: 17, a: 0, d: 15, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2400 },
      { name: 'Теневые ботфорты', slot: 'boots', rarity_id: 6, bonuses: { s: 25, a: 22, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7500 },
      { name: 'Пустотные сапоги', slot: 'boots', rarity_id: 6, bonuses: { s: 0, a: 27, d: 0, m: 21 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7800 },
      { name: 'Бездонные лапы', slot: 'boots', rarity_id: 6, bonuses: { s: 24, a: 20, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7200 },

      // ─── ⚔️ Оружие (Weapons) — 21 предмет ───
      { name: 'Стон могильщика', slot: 'weapon1', rarity_id: 0, bonuses: { s: 2, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 12 },
      { name: 'Гниль утопленника', slot: 'weapon1', rarity_id: 0, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8 },
      { name: 'Плач червей', slot: 'weapon1', rarity_id: 0, bonuses: { s: 1, a: 1, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 10 },
      { name: 'Голод палача', slot: 'weapon1', rarity_id: 1, bonuses: { s: 3, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 40 },
      { name: 'Шёпот душегуба', slot: 'weapon1', rarity_id: 1, bonuses: { s: 3, a: 0, d: 0, m: 2 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 45 },
      { name: 'Тлен некроманта', slot: 'weapon1', rarity_id: 1, bonuses: { s: 4, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Скорбь инквизитора', slot: 'weapon1', rarity_id: 2, bonuses: { s: 6, a: 0, d: 0, m: 4 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 130 },
      { name: 'Мор отступника', slot: 'weapon1', rarity_id: 2, bonuses: { s: 5, a: 4, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 120 },
      { name: 'Жажда гробовщика', slot: 'weapon1', rarity_id: 2, bonuses: { s: 7, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 110 },
      { name: 'Агония мученика', slot: 'weapon1', rarity_id: 3, bonuses: { s: 10, a: 0, d: 6, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Погибель лжепророка', slot: 'weapon1', rarity_id: 3, bonuses: { s: 9, a: 0, d: 0, m: 7 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 350 },
      { name: 'Коса жреца', slot: 'weapon1', rarity_id: 3, bonuses: { s: 8, a: 7, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 300 },
      { name: 'Бездна вивисектора', slot: 'weapon1', rarity_id: 4, bonuses: { s: 14, a: 0, d: 0, m: 11 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 800 },
      { name: 'Расплата схимника', slot: 'weapon1', rarity_id: 4, bonuses: { s: 13, a: 10, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 750 },
      { name: 'Забвение костяного короля', slot: 'weapon1', rarity_id: 4, bonuses: { s: 15, a: 0, d: 10, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 850 },
      { name: 'Проклятие еретика', slot: 'weapon1', rarity_id: 5, bonuses: { s: 20, a: 0, d: 0, m: 16 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2600 },
      { name: 'Ужас псаря', slot: 'weapon1', rarity_id: 5, bonuses: { s: 19, a: 15, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2400 },
      { name: 'Казнь мёртвой невесты', slot: 'weapon1', rarity_id: 5, bonuses: { s: 18, a: 0, d: 15, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 2700 },
      { name: 'Жатва слепой девы', slot: 'weapon1', rarity_id: 6, bonuses: { s: 27, a: 0, d: 0, m: 22 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7800 },
      { name: 'Наваждение червей', slot: 'weapon1', rarity_id: 6, bonuses: { s: 26, a: 20, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7500 },
      { name: 'Суд костяного короля', slot: 'weapon1', rarity_id: 6, bonuses: { s: 28, a: 0, d: 21, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 0 }, cost: 8000 },

      // ─── 🔰 Щиты (Shields) — 21 предмет ───
      { name: 'Гробовая преграда', slot: 'shield', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 }, cost: 10 },
      { name: 'Костяная плита', slot: 'shield', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 2 }, cost: 12 },
      { name: 'Истлевшая защита', slot: 'shield', rarity_id: 0, bonuses: { s: 1, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 }, cost: 8 },
      { name: 'Погребальный барьер', slot: 'shield', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 3 }, cost: 40 },
      { name: 'Черепная стена', slot: 'shield', rarity_id: 1, bonuses: { s: 2, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 2 }, cost: 35 },
      { name: 'Скорбный затвор', slot: 'shield', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 2 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 3 }, cost: 45 },
      { name: 'Надгробный бастион', slot: 'shield', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 4 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 4 }, cost: 120 },
      { name: 'Ритуальная преграда', slot: 'shield', rarity_id: 2, bonuses: { s: 5, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 5 }, cost: 130 },
      { name: 'Проклятый оплот', slot: 'shield', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 5 }, cost: 110 },
      { name: 'Саркофаговая стена', slot: 'shield', rarity_id: 3, bonuses: { s: 8, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 6 }, cost: 320 },
      { name: 'Мертвецкий затвор', slot: 'shield', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 6 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 7 }, cost: 350 },
      { name: 'Кровоточащая крепость', slot: 'shield', rarity_id: 3, bonuses: { s: 7, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 7 }, cost: 300 },
      { name: 'Вдовий бастион', slot: 'shield', rarity_id: 4, bonuses: { s: 12, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 10 }, cost: 750 },
      { name: 'Заупокойная преграда', slot: 'shield', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 10 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 11 }, cost: 800 },
      { name: 'Жертвенная стена', slot: 'shield', rarity_id: 4, bonuses: { s: 10, a: 8, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 9 }, cost: 720 },
      { name: 'Погребальная крепость', slot: 'shield', rarity_id: 5, bonuses: { s: 17, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 15 }, cost: 2500 },
      { name: 'Истлевший оплот', slot: 'shield', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 14 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 17 }, cost: 2700 },
      { name: 'Костяной бастион', slot: 'shield', rarity_id: 5, bonuses: { s: 16, a: 13, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 14 }, cost: 2400 },
      { name: 'Саркофаговая крепость', slot: 'shield', rarity_id: 6, bonuses: { s: 24, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 22 }, cost: 7500 },
      { name: 'Мёртвая стена', slot: 'shield', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 20 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 24 }, cost: 8000 },
      { name: 'Проклятый бастион', slot: 'shield', rarity_id: 6, bonuses: { s: 23, a: 18, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 21 }, cost: 7800 },

      // ─── 🧿 Амулеты (Amulets) — 21 предмет ───
      { name: 'Зуб мёртвых', slot: 'amulet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 1, dodge: 0, counter: 0, fullBlock: 0 }, cost: 10 },
      { name: 'Осколок гнили', slot: 'amulet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 1, counter: 0, fullBlock: 0 }, cost: 8 },
      { name: 'Фаланга скорби', slot: 'amulet', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 }, cost: 12 },
      { name: 'Глаз падших', slot: 'amulet', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 2, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Клык забытых', slot: 'amulet', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 3, counter: 0, fullBlock: 0 }, cost: 40 },
      { name: 'Медальон бездны', slot: 'amulet', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 2, fullBlock: 0 }, cost: 30 },
      { name: 'Реликвия неупокоенных', slot: 'amulet', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 4, dodge: 0, counter: 3, fullBlock: 0 }, cost: 120 },
      { name: 'Сердце тьмы', slot: 'amulet', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 5, counter: 0, fullBlock: 0 }, cost: 110 },
      { name: 'Фетиш мора', slot: 'amulet', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 5, fullBlock: 0 }, cost: 115 },
      { name: 'Печать загробья', slot: 'amulet', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 6, dodge: 0, counter: 0, fullBlock: 5 }, cost: 300 },
      { name: 'Слеза чертога боли', slot: 'amulet', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 8, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Идол вечного сна', slot: 'amulet', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 7, dodge: 0, counter: 6, fullBlock: 0 }, cost: 350 },
      { name: 'Узел шёпота', slot: 'amulet', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 10, dodge: 0, counter: 8, fullBlock: 0 }, cost: 750 },
      { name: 'Талисман лимба', slot: 'amulet', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 12, counter: 0, fullBlock: 0 }, cost: 720 },
      { name: 'Ладонка пустоты', slot: 'amulet', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 9, dodge: 0, counter: 0, fullBlock: 9 }, cost: 800 },
      { name: 'Ключ некрополя', slot: 'amulet', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 15, dodge: 0, counter: 12, fullBlock: 0 }, cost: 2500 },
      { name: 'Сердце безмолвия', slot: 'amulet', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 17, counter: 0, fullBlock: 0 }, cost: 2700 },
      { name: 'Желчь мёртвых', slot: 'amulet', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 14, dodge: 0, counter: 0, fullBlock: 13 }, cost: 2400 },
      { name: 'Глаз бездны', slot: 'amulet', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 22, dodge: 0, counter: 18, fullBlock: 0 }, cost: 7800 },
      { name: 'Печать плача', slot: 'amulet', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 24, counter: 0, fullBlock: 0 }, cost: 7500 },
      { name: 'Слеза могилы', slot: 'amulet', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 20, dodge: 0, counter: 0, fullBlock: 19 }, cost: 8000 },

      // ─── 💍 Кольца (Rings) — 21 предмет ───
      { name: 'Виток немых', slot: 'ring', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 1, counter: 0, fullBlock: 0 }, cost: 9 },
      { name: 'Петля слепых', slot: 'ring', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 1, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7 },
      { name: 'Обруч глухих', slot: 'ring', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 1 }, cost: 10 },
      { name: 'Кольцо мёртвых уз', slot: 'ring', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 2, counter: 0, fullBlock: 0 }, cost: 32 },
      { name: 'Печатка кровавых клятв', slot: 'ring', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 2, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Спираль тёмных обетов', slot: 'ring', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 2, fullBlock: 0 }, cost: 30 },
      { name: 'Хватка сломанных судеб', slot: 'ring', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 4, dodge: 0, counter: 3, fullBlock: 0 }, cost: 115 },
      { name: 'Оковы разорванных душ', slot: 'ring', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 5, counter: 0, fullBlock: 0 }, cost: 110 },
      { name: 'Узел теневого ковена', slot: 'ring', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 4, fullBlock: 0 }, cost: 120 },
      { name: 'Кольцо костяного трона', slot: 'ring', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 7, dodge: 0, counter: 0, fullBlock: 6 }, cost: 320 },
      { name: 'Печатка пепельного царства', slot: 'ring', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 8, counter: 0, fullBlock: 0 }, cost: 350 },
      { name: 'Виток червового короля', slot: 'ring', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 6, dodge: 0, counter: 6, fullBlock: 0 }, cost: 300 },
      { name: 'Хватка багрового пира', slot: 'ring', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 10, dodge: 8, counter: 0, fullBlock: 0 }, cost: 750 },
      { name: 'Спираль воронья', slot: 'ring', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 11, counter: 0, fullBlock: 0 }, cost: 700 },
      { name: 'Цепь крысиного короля', slot: 'ring', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 9, dodge: 0, counter: 0, fullBlock: 10 }, cost: 800 },
      { name: 'Кольцо змеиного гнезда', slot: 'ring', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 16, dodge: 0, counter: 14, fullBlock: 0 }, cost: 2500 },
      { name: 'Обруч волчьего часа', slot: 'ring', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 18, counter: 0, fullBlock: 0 }, cost: 2700 },
      { name: 'Оковы проклятых', slot: 'ring', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 15, dodge: 0, counter: 0, fullBlock: 14 }, cost: 2400 },
      { name: 'Кольцо забвенных', slot: 'ring', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 22, dodge: 0, counter: 19, fullBlock: 0 }, cost: 7500 },
      { name: 'Печатка разорванных душ', slot: 'ring', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 24, counter: 0, fullBlock: 0 }, cost: 7800 },
      { name: 'Хватка теневого ковена', slot: 'ring', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 21, dodge: 0, counter: 0, fullBlock: 20 }, cost: 8000 },

      // ─── 🩸 Пояса (Belts) — 21 предмет ───
      { name: 'Кишечный ремень', slot: 'belt', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 1, fullBlock: 0 }, cost: 8 },
      { name: 'Кожаная перевязь', slot: 'belt', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 1, counter: 0, fullBlock: 0 }, cost: 10 },
      { name: 'Жильный кушак', slot: 'belt', rarity_id: 0, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 1, dodge: 0, counter: 0, fullBlock: 0 }, cost: 7 },
      { name: 'Сухожильный пояс', slot: 'belt', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 2, counter: 0, fullBlock: 0 }, cost: 30 },
      { name: 'Скальповый ремень', slot: 'belt', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 2, dodge: 0, counter: 0, fullBlock: 0 }, cost: 35 },
      { name: 'Кандальная портупея', slot: 'belt', rarity_id: 1, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 0, counter: 0, fullBlock: 2 }, cost: 32 },
      { name: 'Рёберный кушак', slot: 'belt', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 4, dodge: 0, counter: 3, fullBlock: 0 }, cost: 110 },
      { name: 'Мускульный жгут', slot: 'belt', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 5, counter: 0, fullBlock: 0 }, cost: 120 },
      { name: 'Позвоночная перевязь', slot: 'belt', rarity_id: 2, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 3, dodge: 0, counter: 4, fullBlock: 0 }, cost: 115 },
      { name: 'Удавной ремень', slot: 'belt', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 7, dodge: 0, counter: 0, fullBlock: 6 }, cost: 300 },
      { name: 'Трупный кушак', slot: 'belt', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 8, counter: 0, fullBlock: 0 }, cost: 320 },
      { name: 'Петлевой пояс', slot: 'belt', rarity_id: 3, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 6, dodge: 6, counter: 0, fullBlock: 0 }, cost: 350 },
      { name: 'Мертвецкая портупея', slot: 'belt', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 11, dodge: 0, counter: 9, fullBlock: 0 }, cost: 750 },
      { name: 'Жгутовый ремень', slot: 'belt', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 12, counter: 0, fullBlock: 0 }, cost: 700 },
      { name: 'Цепная перевязь', slot: 'belt', rarity_id: 4, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 10, dodge: 0, counter: 0, fullBlock: 9 }, cost: 800 },
      { name: 'Удавной жгут', slot: 'belt', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 16, dodge: 0, counter: 14, fullBlock: 0 }, cost: 2500 },
      { name: 'Трупная портупея', slot: 'belt', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 18, counter: 0, fullBlock: 0 }, cost: 2700 },
      { name: 'Позвоночный пояс', slot: 'belt', rarity_id: 5, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 15, dodge: 0, counter: 0, fullBlock: 13 }, cost: 2400 },
      { name: 'Мертвецкий ремень', slot: 'belt', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 23, dodge: 0, counter: 19, fullBlock: 0 }, cost: 7500 },
      { name: 'Кандальный кушак', slot: 'belt', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 0, dodge: 24, counter: 0, fullBlock: 0 }, cost: 7800 },
      { name: 'Удавная перевязь', slot: 'belt', rarity_id: 6, bonuses: { s: 0, a: 0, d: 0, m: 0 }, extra: { crit: 21, dodge: 0, counter: 0, fullBlock: 20 }, cost: 8000 },
    ];

    const rarityColorNames = ['gray', 'white', 'green', 'blue', 'purple', 'yellow', 'red'];

    for (const item of allItems) {
      const folder = item.slot === 'weapon1' ? 'sword' : item.slot;
      const color = rarityColorNames[item.rarity_id] || 'gray';
      const image = `${folder}/${folder}_${color}.webp`;

      await db.run(INSERT_ITEM,
        [item.name, item.slot, item.rarity_id, JSON.stringify(item.bonuses), JSON.stringify(item.extra), image, item.cost]
      );
    }
  }

  // Начальные работы (20 работ) — добавляем только если таблица пуста
  const jobCount = (await db.one('SELECT COUNT(*) as c FROM jobs') as any).c;
  if (jobCount === 0) {
  const INSERT_JOB =
    'INSERT INTO jobs (name, description, duration, rewardMin, rewardMax) VALUES (?, ?, ?, ?, ?)';

  const jobs: Array<{ name: string; description: string; duration: number; rewardMin: number; rewardMax: number }> = [
      // 🏰 На территории замка — 10 минут
      { name: 'Обход стен', description: 'Дозор по крепостной стене. Факел, ветер, шёпот из бойниц.', duration: 600, rewardMin: 2, rewardMax: 5 },
      { name: 'Чистка склепа', description: 'Вынести истлевшие останки, заменить свечи, отогнать крыс.', duration: 600, rewardMin: 3, rewardMax: 6 },
      { name: 'Кормление псов', description: 'Псарня у восточной башни. Мясо с костями, не спрашивай чьими.', duration: 600, rewardMin: 2, rewardMax: 5 },
      { name: 'Заточка оружия', description: 'Точильный круг в оружейной. Клинки для гарнизона, кровь не отмывать.', duration: 600, rewardMin: 3, rewardMax: 7 },
      { name: 'Растопка печей', description: 'Главный зал, кухня, казармы. Угля хватит, только не смотри в поддувало.', duration: 600, rewardMin: 2, rewardMax: 5 },
      // 🏰 На территории замка — 30 минут
      { name: 'Уборка темницы', description: 'Цепи, сырость, стоны из пустых камер. Вынести ведро — и назад.', duration: 1800, rewardMin: 10, rewardMax: 20 },
      { name: 'Помощь на кухне', description: 'Разделка мяса для гарнизона. Топором. Не принюхивайся.', duration: 1800, rewardMin: 10, rewardMax: 22 },
      { name: 'Осмотр крипты', description: 'Проверить сохранность саркофагов, доложить о свежих трещинах.', duration: 1800, rewardMin: 12, rewardMax: 25 },
      { name: 'Полив сада костей', description: 'На внутреннем дворе растут белые цветы. Удобрять только золой.', duration: 1800, rewardMin: 10, rewardMax: 22 },
      { name: 'Сортировка арсенала', description: 'Пересчитать стрелы, заменить сгнившую тетиву, промаркировать яды.', duration: 1800, rewardMin: 12, rewardMax: 25 },
      // 💀 За территорией замка — 1 час
      { name: 'Вылазка в Деревню Пепла', description: 'Сгоревшее поселение к востоку. Найти припасы, не стать пеплом.', duration: 3600, rewardMin: 35, rewardMax: 80 },
      { name: 'Охота на бродячих мертвецов', description: 'Лес Черепов. Мертвецы не спят. Вернись с трофеями.', duration: 3600, rewardMin: 40, rewardMax: 90 },
      { name: 'Сбор скверноцвета', description: 'Ядовитые луга. Цветы для алхимика. Надевай перчатки.', duration: 3600, rewardMin: 35, rewardMax: 75 },
      { name: 'Разведка Старого Тракта', description: 'Заброшенная дорога на север. Карта, отметки, не сворачивай.', duration: 3600, rewardMin: 40, rewardMax: 85 },
      { name: 'Зачистка Катакомб', description: 'Первый ярус подземелий за стеной. Пауки, плесень, золото.', duration: 3600, rewardMin: 45, rewardMax: 100 },
      // 💀 За территорией замка — 8 часов
      { name: 'Экспедиция к Чёрному Монастырю', description: 'Руины на холме. Реликвии, еретики, колокола звонят сами.', duration: 28800, rewardMin: 300, rewardMax: 600 },
      { name: 'Поход в Гнилую Топь', description: 'Болота к югу. Утопленники, трясина, редкий лут.', duration: 28800, rewardMin: 280, rewardMax: 550 },
      { name: 'Осада Башни Плакальщиц', description: 'Западная граница. Призраки, крики, сокровища в подвале.', duration: 28800, rewardMin: 320, rewardMax: 650 },
      { name: 'Рейд на Некрополь Королей', description: 'Древние гробницы. Ловушки, стража, короны мертвецов.', duration: 28800, rewardMin: 350, rewardMax: 700 },
      { name: 'Контракт в Бездонный Овраг', description: 'Трещина в земле на севере. Там, куда не смотрит свет.', duration: 28800, rewardMin: 330, rewardMax: 680 },
    ];

  for (const job of jobs) {
    await db.run(INSERT_JOB, [job.name, job.description, job.duration, job.rewardMin, job.rewardMax]);
  }
  }

  // Начальные названия характеристик
  const statCount = (await db.one('SELECT COUNT(*) as cnt FROM stat_names') as any).cnt;
  if (statCount === 0) {
    const INSERT_STAT = 'INSERT INTO stat_names (name, nameRu) VALUES (?, ?)';
    const stats = [
      ['s', 'Сила'], ['a', 'Ловкость'], ['d', 'Защита'], ['m', 'Мастерство'],
      ['crit', 'Крит'], ['dodge', 'Уклонение'], ['counter', 'Контрудар'],
      ['fullBlock', 'Полный блок'], ['block', 'Блок'],
    ];
    for (const [name, nameRu] of stats) await db.run(INSERT_STAT, [name, nameRu]);
  }

  // Начальные ресурсы (материалы + камни улучшения)
  const craftItemCount = (await db.one('SELECT COUNT(*) as cnt FROM craft_items') as any).cnt;
  if (craftItemCount === 0) {
    const INSERT_CRAFT = 'INSERT INTO craft_items (name, rarity_id, type, image) VALUES (?, ?, ?, ?)';
    // Материалы (type='craft')
    const materialNames = ['Пыль забвения', 'Осколок скорби', 'Фрагмент ужаса', 'Эссенция мрака', 'Сердцевина бездны', 'Искра погибели', 'Слеза вечности'];
    for (let i = 0; i < materialNames.length; i++) await db.run(INSERT_CRAFT, [materialNames[i], i, 'craft', null]);
    // Камни улучшения (type='upgrade')
    const stoneNames = ['Камень улучшения (Хлам)', 'Камень улучшения (Обычный)', 'Камень улучшения (Необычный)', 'Камень улучшения (Редкий)', 'Камень улучшения (Эпический)', 'Камень улучшения (Легендарный)', 'Камень улучшения (Мифический)'];
    for (let i = 0; i < stoneNames.length; i++) await db.run(INSERT_CRAFT, [stoneNames[i], i, 'upgrade', null]);
  }

  // Начальные категории рецептов
  const catCount = (await db.one('SELECT COUNT(*) as cnt FROM craft_recipe_categories') as any).cnt;
  if (catCount === 0) {
    await db.run('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)', ['Материалы', 1]);
    await db.run('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)', ['Улучшения', 2]);
  }

  // Категория «Предметы» (добавляем если нет)
  try { await db.run('INSERT INTO craft_recipe_categories (name, sort_order) VALUES (?, ?)', ['Предметы', 3]); } catch {}

  // Начальные шансы улучшения (по редкости и уровню)
  const upgradeChanceCount = (await db.one('SELECT COUNT(*) as cnt FROM upgrade_chances') as any).cnt;
  // Если данных нет или только одна редкость — перезаполняем все
  if (upgradeChanceCount < 70) {
    await db.run('DELETE FROM upgrade_chances');
    const INSERT_UPGRADE = 'INSERT INTO upgrade_chances (level, rarity_id, chance, money_cost) VALUES (?, ?, ?, ?) ON CONFLICT (level, rarity_id) DO UPDATE SET chance = EXCLUDED.chance, money_cost = EXCLUDED.money_cost';
    const chances: number[] = [100, 90, 70, 50, 25, 10, 5, 3, 2, 1];
    const costs: Record<number, number[]> = {
      0: [5, 8, 15, 25, 40, 60, 90, 130, 200, 300],        // Хлам
      1: [15, 25, 45, 75, 120, 180, 270, 400, 600, 900],    // Обычный
      2: [50, 80, 150, 250, 400, 600, 900, 1400, 2000, 3000], // Необычный
      3: [150, 250, 450, 800, 1300, 2000, 3000, 4500, 6500, 10000], // Редкий
      4: [400, 700, 1300, 2500, 4000, 6000, 9000, 14000, 20000, 30000], // Эпический
      5: [1000, 1800, 3500, 6500, 10000, 16000, 25000, 38000, 55000, 80000], // Легендарный
      6: [3000, 5000, 10000, 18000, 30000, 45000, 70000, 100000, 150000, 220000], // Мифический
    };
    for (let rarity = 0; rarity <= 6; rarity++) {
      for (let lvl = 0; lvl < 10; lvl++) {
        await db.run(INSERT_UPGRADE, [lvl + 1, rarity, chances[lvl], costs[rarity][lvl]]);
      }
    }
  }

  // Начальные рецепты крафта (материалы + камни улучшения)
  const recipeCount = (await db.one('SELECT COUNT(*) as cnt FROM craft_recipes') as any).cnt;
  if (recipeCount === 0) {
    const INSERT_RECIPE =
      'INSERT INTO craft_recipes (name, description, money_cost, result_type, result_id, success_chance, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
    const INSERT_INGREDIENT =
      'INSERT INTO craft_recipe_ingredients (recipe_id, craft_item_id, quantity) VALUES (?, ?, ?)';
    const getCraftItemId = async (name: string): Promise<number> =>
      (await db.one('SELECT id FROM craft_items WHERE name = ?', [name]) as any).id;
    const getCatId = async (name: string): Promise<number> =>
      (await db.one('SELECT id FROM craft_recipe_categories WHERE name = ?', [name]) as any).id;

    const matCatId = await getCatId('Материалы');

    // Рецепты улучшения материалов (раздел «Материалы»)
    const materialRecipes: Array<{
      name: string; description: string; cost: number;
      result: string; chance: number; ingredients: Array<{ name: string; qty: number }>;
    }> = [
      { name: 'Пыль забвения → Осколок скорби', description: '5 Пыли забвения в 1 Осколок скорби', cost: 5, result: 'Осколок скорби', chance: 80, ingredients: [{ name: 'Пыль забвения', qty: 5 }] },
      { name: 'Осколок скорби → Фрагмент ужаса', description: '5 Осколков скорби в 1 Фрагмент ужаса', cost: 20, result: 'Фрагмент ужаса', chance: 75, ingredients: [{ name: 'Осколок скорби', qty: 5 }] },
      { name: 'Фрагмент ужаса → Эссенция мрака', description: '5 Фрагментов ужаса в 1 Эссенцию мрака', cost: 75, result: 'Эссенция мрака', chance: 70, ingredients: [{ name: 'Фрагмент ужаса', qty: 5 }] },
      { name: 'Эссенция мрака → Сердцевина бездны', description: '5 Эссенций мрака в 1 Сердцевину бездны', cost: 250, result: 'Сердцевина бездны', chance: 65, ingredients: [{ name: 'Эссенция мрака', qty: 5 }] },
      { name: 'Сердцевина бездны → Искра погибели', description: '7 Сердцевин бездны в 1 Искру погибели', cost: 875, result: 'Искра погибели', chance: 60, ingredients: [{ name: 'Сердцевина бездны', qty: 7 }] },
      { name: 'Искра погибели → Слеза вечности', description: '9 Искр погибели в 1 Слезу вечности', cost: 3000, result: 'Слеза вечности', chance: 50, ingredients: [{ name: 'Искра погибели', qty: 9 }] },
    ];

    const allRecipes = [
      ...materialRecipes.map(r => ({ ...r, categoryId: matCatId })),
    ];

    for (const r of allRecipes) {
      const info = await db.run(INSERT_RECIPE, [r.name, r.description, r.cost, 'craft_item', await getCraftItemId(r.result), r.chance, r.categoryId]);
      const recipeId = info.lastInsertRowid;
      for (const ing of r.ingredients) {
        await db.run(INSERT_INGREDIENT, [recipeId, await getCraftItemId(ing.name), ing.qty]);
      }
    }
  }

  // Рецепты случайных предметов (всегда проверяем, добавляем если нет)
  {
    const itemRecipeCount = (await db.one("SELECT COUNT(*) as cnt FROM craft_recipes WHERE result_type = 'random_item'") as any).cnt;
    if (itemRecipeCount === 0) {
      const INSERT_RECIPE =
        'INSERT INTO craft_recipes (name, description, money_cost, result_type, result_id, success_chance, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)';
      const INSERT_INGREDIENT =
        'INSERT INTO craft_recipe_ingredients (recipe_id, craft_item_id, quantity) VALUES (?, ?, ?)';
      const getCraftItemId = async (name: string): Promise<number> =>
        (await db.one('SELECT id FROM craft_items WHERE name = ?', [name]) as any).id;
      const getCatId = async (name: string): Promise<number> =>
        (await db.one('SELECT id FROM craft_recipe_categories WHERE name = ?', [name]) as any).id;

      const itemCatId = await getCatId('Предметы');
      const itemRecipes: Array<{
        name: string; description: string; cost: number;
        rarity: number; chance: number; ingredients: Array<{ name: string; qty: number }>;
      }> = [
        { name: 'Случайный предмет (Хлам)', description: 'Создать случайный предмет качества Хлам', cost: 5, rarity: 0, chance: 90, ingredients: [{ name: 'Пыль забвения', qty: 1 }] },
        { name: 'Случайный предмет (Обычный)', description: 'Создать случайный предмет Обычного качества', cost: 15, rarity: 1, chance: 85, ingredients: [{ name: 'Осколок скорби', qty: 1 }] },
        { name: 'Случайный предмет (Необычный)', description: 'Создать случайный предмет Необычного качества', cost: 40, rarity: 2, chance: 80, ingredients: [{ name: 'Фрагмент ужаса', qty: 1 }] },
        { name: 'Случайный предмет (Редкий)', description: 'Создать случайный предмет Редкого качества', cost: 125, rarity: 3, chance: 75, ingredients: [{ name: 'Эссенция мрака', qty: 1 }] },
        { name: 'Случайный предмет (Эпический)', description: 'Создать случайный предмет Эпического качества', cost: 400, rarity: 4, chance: 70, ingredients: [{ name: 'Сердцевина бездны', qty: 1 }] },
        { name: 'Случайный предмет (Легендарный)', description: 'Создать случайный предмет Легендарного качества', cost: 1250, rarity: 5, chance: 65, ingredients: [{ name: 'Искра погибели', qty: 1 }] },
        { name: 'Случайный предмет (Мифический)', description: 'Создать случайный предмет Мифического качества', cost: 4000, rarity: 6, chance: 50, ingredients: [{ name: 'Слеза вечности', qty: 1 }] },
      ];
      for (const r of itemRecipes) {
        const info = await db.run(INSERT_RECIPE, [r.name, r.description, r.cost, 'random_item', r.rarity, r.chance, itemCatId]);
        const recipeId = info.lastInsertRowid;
        for (const ing of r.ingredients) {
          await db.run(INSERT_INGREDIENT, [recipeId, await getCraftItemId(ing.name), ing.qty]);
        }
      }
    }
  }

  // Мобы (PvE бестиарий)
  const mobCount = (await db.one('SELECT COUNT(*) as cnt FROM mobs') as any).cnt;
  if (mobCount === 0) {
    const INSERT_MOB = `INSERT INTO mobs (name, level, hp, atk, agi, def, mst, xp, gold_min, gold_max,
      loot_junk, loot_common, loot_uncommon, loot_rare, loot_epic, loot_legendary, loot_mythic, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

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

    for (const m of mobs) await db.run(INSERT_MOB, m);
  }

  // Стандартные сеты коллекций (7 редкостей)
  const collectionSetCount = (await db.one('SELECT COUNT(*) as cnt FROM collection_sets') as any).cnt;
  if (collectionSetCount === 0) {
    const allSlots = ['helmet', 'chest', 'gloves', 'boots', 'weapon1', 'shield', 'amulet', 'ring', 'belt'];
    const raritySetNames = ['Коллекция Хлама', 'Коллекция Обычных', 'Коллекция Необычных', 'Коллекция Редких', 'Коллекция Эпических', 'Коллекция Легендарных', 'Коллекция Мифических'];
    const INSERT_SET = 'INSERT INTO collection_sets (name, description, bonus_percent, sort_order) VALUES (?, ?, ?, ?)';
    const INSERT_SET_ITEM = 'INSERT INTO collection_set_items (set_id, item_name, slot) VALUES (?, ?, ?)';

    for (let rarity = 0; rarity <= 6; rarity++) {
      const info = await db.run(INSERT_SET, [raritySetNames[rarity], `Все предметы редкости ${rarity}`, rarity + 1, rarity + 1]);
      const setId = info.lastInsertRowid as number;

      const rarityItems = await db.query('SELECT name, slot FROM items WHERE rarity_id = ?', [rarity]) as any[];
      for (const item of rarityItems) {
        await db.run(INSERT_SET_ITEM, [setId, item.name, item.slot]);
      }
    }
  }
}
