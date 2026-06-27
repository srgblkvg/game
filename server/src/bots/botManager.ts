// In-process bot manager — управление ботами из админки
import { db } from '../db/index';
import { pickBotName, releaseBotName } from './botNames';

const API_BASE = `http://localhost:${process.env.PORT || 3001}/api`;

interface BotAccount { id: number; username: string; token: string; active: boolean; }
interface BotStats { actions: number; lastAction: string; lastActionResult: string; }
interface BotState { account: BotAccount; running: boolean; cooldowns: Record<string, number>; stats: BotStats; }

const bots = new Map<number, BotState>();
let globalRunning = false;
const stopFlags = new Map<number, boolean>();

const EQUIP_SLOTS = ['weapon1','shield','helmet','chest','gloves','boots','ring1','ring2','amulet','belt'];

db.run(`CREATE TABLE IF NOT EXISTS bot_accounts (
  id SERIAL PRIMARY KEY, userId INTEGER NOT NULL UNIQUE, username TEXT NOT NULL,
  token TEXT NOT NULL, active INTEGER DEFAULT 1, createdAt TEXT NOT NULL
)`).catch(() => {});

const ACTIONS: Record<string, { weight: number; cooldown: number }> = {
  manage_eq:   { weight: 15, cooldown: 120 },  // экипировка + аукцион-продажа
  pve:         { weight: 25, cooldown: 300 },
  pvp:         { weight: 10, cooldown: 300 },
  job:         { weight: 20, cooldown: 600 },
  auction_buy: { weight: 15, cooldown: 60  },
  craft:       { weight: 8,  cooldown: 120 },
  rest:        { weight: 7,  cooldown: 120 },
  tournament:  { weight: 20, cooldown: 30  },  // проверка турниров каждые 30 сек
};

// ─── API ───
async function apiCall(token: string, method: string, path: string, body: any = null): Promise<any> {
  const opts: any = { method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}
async function apiGet(token: string, path: string): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
  return res.json();
}

// ─── Регистрация ───
async function registerBot(): Promise<BotAccount> {
  const res = await fetch(`${API_BASE}/guest`, { method: 'POST' });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data.error);

  // Подобрать уникальное имя из пула
  const botName = pickBotName();
  if (botName) {
    try {
      await db.run('UPDATE users SET username = ? WHERE id = ?', [botName, data.user.id]);
      data.user.username = botName;
    } catch { /* имя уже занято — оставляем гостевое */ }
  }

  await db.run('INSERT INTO bot_accounts (userId, username, token, active, createdAt) VALUES (?, ?, ?, 1, ?)',
    [data.user.id, data.user.username, data.token, new Date().toISOString()]);
  return { id: data.user.id, username: data.user.username, token: data.token, active: true };
}
async function getStoredBots(): Promise<BotAccount[]> {
  const rows = await db.query('SELECT * FROM bot_accounts WHERE active = 1') as any[];
  return rows.map(r => ({ id: r.userid, username: r.username, token: r.token, active: true }));
}

// ─── Оценка предмета (чем больше — тем лучше) ───
function itemScore(item: any): number {
  if (!item) return -1;
  let score = (item.rarity_id ?? 0) * 100;
  const b = item.bonuses || {};
  score += (b.s||0) + (b.a||0)*1.1 + (b.d||0)*1.2 + (b.m||0)*0.9 + (b.hp||0)*0.5;
  score += (b.extra?.dodge||0)*2 + (b.extra?.crit||0)*2 + (b.extra?.counter||0)*2 + (b.extra?.fullBlock||0)*3;
  return score;
}

// ─── Управление экипировкой + продажа хлама ───
async function doManageEq(token: string, botId: number, state: BotState) {
  const char = await apiGet(token, '/character/me');
  if (!char || char.error || !char.inventory) { state.stats.lastActionResult = `Ошибка персонажа: ${char?.error || 'нет инвентаря'}`; return; }

  const inv: any[] = char.inventory || [];
  const eq: Record<string, any> = char.equipment || {};
  let actions: string[] = [];

  // 1. Надеть лучшие предметы
  for (const slot of EQUIP_SLOTS) {
    const current = eq[slot];
    const currentScore = itemScore(current);
    const candidates = inv.filter((i: any) => {
      if (i.type === 'craft_item' || i.type === 'material') return false;
      const itemSlot = i.slot || '';
      if (slot.startsWith('weapon') && itemSlot.startsWith('weapon')) return true;
      if (slot.startsWith('ring') && itemSlot.startsWith('ring')) return true;
      return itemSlot === slot;
    });
    if (!candidates.length) continue;

    const best = candidates.reduce((a, b) => itemScore(a) > itemScore(b) ? a : b);
    if (itemScore(best) > currentScore) {
      try {
        await apiCall(token, 'POST', '/character/equip', { slotId: slot, itemId: best.id });
        actions.push(`Надел ${best.name} в ${slot}`);
        // Обновляем инвентарь в памяти
        const idx = inv.findIndex((i: any) => i.id === best.id);
        if (idx !== -1) { if (current) inv[idx] = current; else inv.splice(idx, 1); }
        eq[slot] = best;
      } catch (e: any) { /* слот не подходит — пропускаем */ }
    }
  }

  // 2. Продать на аукционе ненужное
  const now = Math.floor(Date.now() / 1000);
  const currentInv = (await apiGet(token, '/character/me')).inventory || [];
  const currentEq: Record<string, any> = (await apiGet(token, '/character/me')).equipment || {};

  for (const item of currentInv) {
    if (actions.length >= 3) break; // макс 3 действия за раз

    const isEquipped = Object.values(currentEq).some((e: any) => e?.id === item.id);
    if (isEquipped) continue;

    // Продаём: материалы > 5 шт, ненужные предметы (низкий скор), камни улучшения
    const isMaterial = item.type === 'craft_item' || item.type === 'material';
    const shouldSell = isMaterial
      ? (item.count || 1) >= 5  // продаём излишки материалов
      : itemScore(item) < 30;   // продаём слабые предметы

    if (shouldSell) {
      try {
        const count = isMaterial ? Math.floor((item.count || 1) / 2) : 1;
        const price = Math.max(5, itemScore(item) * 10);
        // Цена выкупа: предметы ×3, камни улучшения ×100, материалы ×3
        const isUpgradeStone = item.name?.includes('Камень улучшения') || item.itemType === 'upgrade';
        const buyoutMult = isUpgradeStone ? 100 : 3;
        const buyoutPrice = price * buyoutMult;
        await apiCall(token, 'POST', '/auction/sell', {
          itemData: item,
          startPrice: price,
          buyoutPrice: buyoutPrice,
          duration: 24,
          count: Math.max(1, count),
        });
        actions.push(`Продал ${item.name}×${count} за ${price}🥇 (выкуп ${buyoutPrice}🥇)`);
      } catch (e: any) { /* нет денег на комиссию */ }
    }
  }

  // 3. Распределить свободные очки статов
  const freshChar = await apiGet(token, '/character/me');
  const pts = freshChar.statPoints || 0;
  if (pts > 0) {
    // Случайное распределение с упором на S (сила) и D (защита)
    const r = Math.random();
    let s = 0, a = 0, d = 0, m = 0;
    if (r < 0.35) { s = pts; }           // 35% — всё в силу
    else if (r < 0.55) { d = pts; }      // 20% — всё в защиту
    else if (r < 0.70) { a = pts; }      // 15% — всё в ловкость
    else if (r < 0.80) { m = pts; }      // 10% — всё в магию
    else {                                // 20% — равномерно
      s = Math.floor(pts / 4);
      a = Math.floor(pts / 4);
      d = Math.floor(pts / 4);
      m = pts - s - a - d;
    }
    try {
      await apiCall(token, 'POST', '/character/allocate-stats', { s, a, d, m });
      actions.push(`Распределил ${pts} очков (S:${s} A:${a} D:${d} M:${m})`);
    } catch (e: any) { /* не вышло */ }
  }

  // 4. Квесты: взять доступные, сдать выполненные
  try {
    const questsRes = await apiGet(token, '/tavern/quests');
    const quests = questsRes.quests || [];
    // Сдать выполненные
    for (const q of quests) {
      if (q.status === 'active' && q.progress >= q.requirement) {
        try {
          const claim = await apiCall(token, 'POST', '/tavern/quests/claim', { questId: q.id });
          actions.push(`Сдал квест «${q.typeName}» +${claim.rewardXp || 0}XP +${claim.rewardMoney || 0}🥇`);
        } catch (e: any) { /* не вышло */ }
      }
    }
    // Взять новые (до 3 активных)
    const activeCount = quests.filter((q: any) => q.status === 'active').length;
    if (activeCount < 3) {
      const available = quests.filter((q: any) => q.status === 'available');
      for (const q of available.slice(0, 3 - activeCount)) {
        try {
          await apiCall(token, 'POST', '/tavern/quests/take', { questId: q.id });
          actions.push(`Взял квест «${q.typeName}»`);
        } catch (e: any) { /* лимит */ }
      }
    }
  } catch (e: any) { /* квесты не критичны */ }

  state.stats.lastActionResult = actions.length ? actions.join('; ') : 'Экипировка ок, продавать нечего';
}

// ─── Проверка HP и авто-лечение / работа на время регена ───
async function ensureHp(token: string, botId: number): Promise<boolean> {
  const char = await apiGet(token, '/character/me');
  if (!char || char.error) return false;
  const hp = char.currentHp ?? 0;
  const maxHp = char.stats?.hp ?? 50;
  if (maxHp <= 0) return false;
  if (hp >= maxHp * 0.9) return true; // HP >= 90% — можно в бой
  if (char.money < 10) return true;   // нет денег — рискуем

  const missing = maxHp - hp;
  const cost = missing * 2;

  // Есть деньги — лечимся мгновенно
  if (char.money >= cost) {
    try { await apiCall(token, 'POST', '/tavern/heal', { full: true }); } catch {}
    return true;
  }

  return false; // нет денег на лечение — пусть вызывающий решает
}

/** Если HP мало и нет денег — запускает работу примерно на время регена */
async function regenOrWork(token: string, botId: number, state: BotState, curHp: number, maxHp: number): Promise<boolean> {
  const char = await apiGet(token, '/character/me');
  const room = char.room; // {type, until} или null
  const now = Math.floor(Date.now() / 1000);

  // Скорость регена: 1 HP каждые 10 сек × множитель комнаты
  const roomMult = room && room.until > now
    ? (room.type === 'closet' ? 3 : room.type === 'bed' ? 10 : room.type === 'chamber' ? 50 : 1)
    : 1;
  const missing = maxHp - curHp;
  const regenSec = Math.ceil(missing * 10 / roomMult);

  // Подбираем работу подходящей длительности
  const durations = [600, 1800, 3600];
  let bestDur: number = durations[0]!;
  for (const d of durations) { if (d >= regenSec) { bestDur = d; break; } }
  // Если реген дольше самой длинной работы — берём максимальную
  if (regenSec > durations[durations.length - 1]!) bestDur = durations[durations.length - 1]!;

  try {
    await apiCall(token, 'POST', '/jobs/start-random', { duration: bestDur });
    const mins = Math.round(bestDur / 60);
    const regenEstimate = Math.min(missing, Math.floor(bestDur * roomMult / 10));
    state.stats.lastActionResult = `HP ${curHp}/${maxHp} — работа ${mins}мин (реген ~+${regenEstimate} HP)`;
    return true;
  } catch (e: any) {
    state.stats.lastActionResult = `HP ${curHp}/${maxHp} — ${e.message}`;
    return false;
  }
}

// ─── PvE: только мобы ≤ уровня бота, только с полным HP ───
async function doPve(token: string, botId: number, state: BotState) {
  const [mobs, char] = await Promise.all([apiGet(token, '/mobs'), apiGet(token, '/character/me')]);
  if (!Array.isArray(mobs) || !mobs.length) { state.stats.lastActionResult = 'Нет мобов'; return; }
  if (!char || char.error) { state.stats.lastActionResult = `Ошибка персонажа: ${char?.error || 'нет ответа'}`; return; }

  // Проверка HP — не лезем если меньше 90%
  const maxHp = char.stats?.hp || 50;
  const curHp = char.currentHp ?? 0;
  if (curHp < maxHp * 0.9) {
    const healed = await ensureHp(token, botId);
    if (healed) {
      state.stats.lastActionResult = `Лечение перед PvE (${curHp}/${maxHp} HP)`;
      return;
    }
    // Нет денег на лечение — запускаем работу на время регена
    await regenOrWork(token, botId, state, curHp, maxHp);
    return;
  }

  const lvl = char.level || 1;
  // Только мобы не выше уровня бота
  let pool = mobs.filter((m: any) => m.level <= lvl);
  if (!pool.length) { state.stats.lastActionResult = `Нет мобов ≤ ур.${lvl}`; return; }

  // Предпочитаем равных (60%), слабее допустимо (40%)
  const equal = pool.filter((m: any) => m.level === lvl);
  if (equal.length && Math.random() < 0.6) pool = equal;

  const mob = pool[Math.floor(Math.random() * pool.length)];
  if (!mob) { state.stats.lastActionResult = 'Моб не выбран'; return; }

  const result = await apiCall(token, 'POST', '/mob/attack', { mobId: mob.id });
  const won = result.playerWon;
  state.stats.lastActionResult = `PvE: ${mob.name} (ур.${mob.level}) — ${won ? 'победа' : 'поражение'}` +
    (won && result.goldGained ? ` +${result.goldGained}🥇` : '');
}

// ─── PvP: только равные или слабее, реролл за серебро ───
async function doPvp(token: string, botId: number, state: BotState) {
  const char = await apiGet(token, '/character/me');
  if (!char || char.error) { state.stats.lastActionResult = `Ошибка персонажа: ${char?.error || 'нет ответа'}`; return; }

  // Проверяем HP — не лезем если меньше 90%
  const maxHp = char.stats?.hp || 50;
  const curHp = char.currentHp ?? 0;
  if (curHp < maxHp * 0.9) {
    const healed = await ensureHp(token, botId);
    if (healed) {
      state.stats.lastActionResult = `Лечение перед PvP (${curHp}/${maxHp} HP)`;
    } else {
      // Нет денег на лечение — запускаем работу на время регена
      await regenOrWork(token, botId, state, curHp, maxHp);
    }
    return;
  }

  // Получаем соперника через арену (difficulty=equal или easy)
  const diff = Math.random() < 0.7 ? 'equal' : 'easy';
  let opp;
  try {
    opp = await apiGet(token, `/arena/opponent?difficulty=${diff}`);
  } catch (e: any) {
    state.stats.lastActionResult = `PvP: ${e.message}`;
    return;
  }
  if (!opp || !opp.stats) { state.stats.lastActionResult = 'PvP: нет соперников'; return; }

  // Если соперник сильнее и есть деньги — реролл
  if (opp.level > char.level && char.money >= 10) {
    try {
      opp = await apiGet(token, `/arena/opponent?change=true&difficulty=easy`);
      if (opp.level > char.level && char.money >= 10) {
        opp = await apiGet(token, `/arena/opponent?change=true&difficulty=easy`);
      }
    } catch (e: any) { /* не вышло — атакуем что есть */ }
  }

  try {
    const result = await apiCall(token, 'POST', '/battle', { opponentId: opp.id });
    const won = result.hpAfter > 0;
    state.stats.lastActionResult = `PvP: vs ${opp.name} (ур.${opp.level}) — ${won ? 'победа' : 'поражение'}` +
      (result.moneyStolen ? ` ±${result.moneyStolen}🥇` : '');
  } catch (e: any) {
    state.stats.lastActionResult = `PvP: ${e.message}`;
  }
}

// ─── Работа ───
async function doJob(token: string, botId: number, state: BotState) {
  const durations = [600, 1800, 3600];
  const dur = durations[Math.floor(Math.random() * durations.length)];
  await apiCall(token, 'POST', '/jobs/start-random', { duration: dur });
  state.stats.lastActionResult = `Работа: ${dur} сек`;
}

// ─── Аукцион: скупка предметов лучше экипировки ───
async function doAuctionBuy(token: string, botId: number, state: BotState) {
  const char = await apiGet(token, '/character/me');
  if (!char || char.error) { state.stats.lastActionResult = `Ошибка персонажа: ${char?.error || 'нет ответа'}`; return; }
  const lots = await apiGet(token, '/auction');
  if (!Array.isArray(lots) || !lots.length) { state.stats.lastActionResult = 'Аукцион: нет лотов'; return; }

  const eq: Record<string, any> = char.equipment || {};

  // Ищем предметы экипировки, которые лучше текущих
  for (const lot of lots) {
    if (lot.sellerId === char.id) continue;
    const itemData = typeof lot.itemData === 'string' ? JSON.parse(lot.itemData) : lot.itemData;
    if (!itemData || itemData.type === 'craft_item' || itemData.type === 'material') continue;
    if (!itemData.slot) continue;

    const slot = itemData.slot;
    // Находим подходящий слот (weapon → weapon1/weapon2, ring → ring1/ring2)
    const matchingSlots = EQUIP_SLOTS.filter(s =>
      s === slot || (s.startsWith('weapon') && slot.startsWith('weapon')) || (s.startsWith('ring') && slot.startsWith('ring'))
    );
    if (!matchingSlots.length) continue;

    const currentScore = Math.max(...matchingSlots.map(s => itemScore(eq[s])));
    const lotScore = itemScore(itemData);

    if (lotScore > currentScore) {
      const price = lot.buyoutPrice || lot.currentBid || lot.startPrice;
      if (price <= char.money * 0.4) {
        try {
          if (lot.buyoutPrice) {
            await apiCall(token, 'POST', '/auction/buyout', { lotId: lot.id });
          } else {
            await apiCall(token, 'POST', '/auction/bid', { lotId: lot.id, amount: price });
          }
          state.stats.lastActionResult = `Аукцион: купил ${itemData.name} за ${price}🥇 (лучше экипировки)`;
          return;
        } catch (e: any) { /* недостаточно денег — смотрим дальше */ }
      }
    }
  }

  // Если ничего не подошло — случайная ставка на дешёвый лот
  const cheapLots = lots.filter((l: any) => {
    const price = l.buyoutPrice || l.currentBid || l.startPrice;
    return price <= char.money * 0.15 && l.sellerId !== char.id;
  });
  if (cheapLots.length && Math.random() < 0.3) {
    const lot = cheapLots[Math.floor(Math.random() * cheapLots.length)];
    const price = lot.currentBid ? lot.currentBid + Math.max(1, Math.floor(lot.currentBid * 0.05)) : lot.startPrice;
    try {
      await apiCall(token, 'POST', '/auction/bid', { lotId: lot.id, amount: price });
      state.stats.lastActionResult = `Аукцион: ставка ${price}🥇`;
    } catch (e: any) { state.stats.lastActionResult = `Аукцион: ${e.message}`; }
  } else {
    state.stats.lastActionResult = 'Аукцион: ничего не подошло';
  }
}

// ─── Крафт ───
async function doCraft(token: string, botId: number, state: BotState) {
  const recipes = await apiGet(token, '/craft/recipes');
  if (!Array.isArray(recipes) || !recipes.length) { state.stats.lastActionResult = 'Крафт: нет рецептов'; return; }
  // Сортируем по редкости результата (лучшие сначала)
  const sorted = [...recipes].sort((a: any, b: any) =>
    (b.result?.rarity_id || 0) - (a.result?.rarity_id || 0));
  for (const recipe of sorted) {
    if (!recipe) continue;
    try {
      await apiCall(token, 'POST', '/craft/execute', { recipeId: recipe.id });
      state.stats.lastActionResult = `Крафт: ✓ (${recipe.result?.name || recipe.name || 'рецепт'})`;
      return;
    } catch (e: any) {
      if (!e.message.includes('Недостаточно') && !e.message.includes('ингредиент')) throw e;
    }
  }
  state.stats.lastActionResult = 'Крафт: нет ингредиентов';
}

// ─── Турниры: присоединение за 15 сек до старта ───
async function doTournament(token: string, botId: number, state: BotState) {
  const char = await apiGet(token, '/character/me');
  if (!char || char.error) { state.stats.lastActionResult = 'Нет персонажа для турнира'; return; }

  const tRes = await apiGet(token, '/tournament?tab=active');
  const tournaments: any[] = tRes.tournaments || [];
  if (!tournaments.length) { state.stats.lastActionResult = 'Турниров нет'; return; }

  const now = Math.floor(Date.now() / 1000);

  // Отфильтровать: статус registration, регистрация закрывается через ≤15 сек, есть места
  const candidates = tournaments.filter((t: any) => {
    if (t.status !== 'registration') return false;
    const secLeft = (t.registrationEnd || 0) - now;
    if (secLeft > 15 || secLeft < 0) return false;
    const free = (t.maxPlayers || 8) - (t.participantCount || 0);
    if (free <= 0) return false;
    // Уже зарегистрирован?
    if (t.myRegistration) return false;
    // Проверка уровня
    if (char.level < (t.minLevel || 1) || char.level > (t.maxLevel || 999)) return false;
    return true;
  });

  if (!candidates.length) { state.stats.lastActionResult = 'Нет подходящих турниров'; return; }

  // Сортируем: сначала официальные (бесплатные), потом кастомные с уплатой
  candidates.sort((a: any, b: any) => {
    const aFee = a.type === 'custom' ? (a.entryFee || 0) : 0;
    const bFee = b.type === 'custom' ? (b.entryFee || 0) : 0;
    return aFee - bFee;
  });

  let joined: string[] = [];

  for (const t of candidates) {
    const entryFee = t.type === 'custom' ? (t.entryFee || 0) : 0;
    if (entryFee > 0 && char.money < entryFee) continue; // не хватает на взнос

    try {
      const body: any = {};
      if (t.type === 'official') {
        body.division = t.division;
      } else {
        body.tournamentId = t.id;
      }
      await apiCall(token, 'POST', '/tournament/register', body);
      const label = t.type === 'official'
        ? (t.division || 'официальный')
        : (t.name || 'кастомный');
      joined.push(`${label}${entryFee > 0 ? ` (взнос ${entryFee}🥇)` : ''}`);
    } catch (e: any) {
      // Уже зарегистрирован, нет денег, турнир заполнен — всё норм
      if (!e.message.includes('уже зарегистрированы') &&
          !e.message.includes('Недостаточно') &&
          !e.message.includes('заполнен')) {
        state.stats.lastActionResult = `Турнир: ${e.message}`;
        return;
      }
    }
  }

  state.stats.lastActionResult = joined.length
    ? `Турниры: ${joined.join(', ')}`
    : 'Турниры: не подошли (деньги/уровень)';
}

// ─── Лечение ───
async function doRest(token: string, botId: number, state: BotState) {
  const tavern = await apiGet(token, '/tavern');
  const missing = tavern.maxHp - tavern.currentHp;
  if (missing <= 0) { state.stats.lastActionResult = 'HP полное'; return; }
  if (tavern.money < missing * 2) { state.stats.lastActionResult = 'Нет денег на лечение'; return; }
  await apiCall(token, 'POST', '/tavern/heal', { full: Math.random() > 0.5 });
  state.stats.lastActionResult = `Лечение (${missing} HP)`;
}

const actionMap: Record<string, (token: string, botId: number, state: BotState) => Promise<void>> = {
  manage_eq: doManageEq, pve: doPve, pvp: doPvp, job: doJob, auction_buy: doAuctionBuy, craft: doCraft, rest: doRest, tournament: doTournament,
};

// ─── Цикл ───
async function botLoop(botId: number, state: BotState) {
  const { token } = state.account;
  const cooldowns: Record<string, number> = {};

  while (!stopFlags.get(botId)) {
    const now = Date.now() / 1000;
    const available = Object.entries(ACTIONS).filter(([name]) => !cooldowns[name] || cooldowns[name] <= now);
    if (!available.length) { await new Promise(r => setTimeout(r, 5000)); continue; }

    const total = available.reduce((s, [, cfg]) => s + cfg.weight, 0);
    let roll = Math.random() * total;
    let chosen = available[0]![0];
    for (const [name, cfg] of available) { roll -= cfg.weight; if (roll <= 0) { chosen = name; break; } }

    const fn = actionMap[chosen];
    if (fn) {
      try { await fn(token, botId, state); state.stats.actions++; state.stats.lastAction = chosen; }
      catch (e: any) { state.stats.lastActionResult = `Ошибка: ${e.message}`; }
      cooldowns[chosen] = Date.now() / 1000 + (ACTIONS[chosen]?.cooldown ?? 60);
    }
    await new Promise(r => setTimeout(r, 5000 + Math.random() * 25000));
  }
}

// ─── Публичные API ───
export async function startBots(count: number, useExisting: boolean = true): Promise<{ started: number; bots: any[] }> {
  if (globalRunning && bots.size > 0) await stopBots();
  let accounts: BotAccount[] = [];
  if (useExisting) { const stored = await getStoredBots(); if (stored.length) accounts = stored.slice(0, count); }
  while (accounts.length < count) {
    try { accounts.push(await registerBot()); } catch (e: any) { console.error('[Bots] reg err:', e.message); break; }
    await new Promise(r => setTimeout(r, 1000));
  }
  // Переименовать существующих ботов с гостевыми именами
  for (const acc of accounts) {
    if (acc.username.startsWith('Гость_')) {
      const newName = pickBotName();
      if (newName) {
        try {
          await db.run('UPDATE users SET username = ? WHERE id = ?', [newName, acc.id]);
          await db.run('UPDATE bot_accounts SET username = ? WHERE userid = ?', [newName, acc.id]);
          acc.username = newName;
        } catch { /* имя занято */ }
      }
    }
  }
  globalRunning = true;
  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    if (!acc) continue;
    stopFlags.set(acc.id, false);
    const state: BotState = { account: acc, running: true, cooldowns: {}, stats: { actions: 0, lastAction: '', lastActionResult: 'Запущен' } };
    bots.set(acc.id, state);
    setTimeout(() => { if (!stopFlags.get(acc.id)) botLoop(acc.id, state).catch(e => console.error(`[Bot#${acc.id}] err:`, e.message)); }, i * 3000);
  }
  return { started: accounts.length, bots: accounts.map(a => ({ id: a.id, username: a.username })) };
}

export async function stopBots(): Promise<{ stopped: number }> {
  globalRunning = false; let count = 0;
  for (const [id, state] of bots) {
    stopFlags.set(id, true);
    // Освободить имя для повторного использования
    const name = state.account.username;
    if (name && !name.startsWith('Гость_')) releaseBotName(name);
    count++;
  }
  bots.clear(); return { stopped: count };
}

export function getBotsStatus() {
  const result: any[] = [];
  for (const [id, state] of bots) result.push({
    id: state.account.id, username: state.account.username,
    running: state.running, actions: state.stats.actions,
    lastAction: state.stats.lastAction, lastResult: state.stats.lastActionResult,
  });
  return { running: globalRunning && bots.size > 0, count: bots.size, bots: result };
}
