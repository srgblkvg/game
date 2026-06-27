/**
 * Game Bots — наполнение мира активностью
 * Запуск: node bots/runner.js [количество ботов]
 * 
 * Боты регистрируются как гости и выполняют случайные действия:
 * PvE, PvP, работы, аукцион, магазин, крафт
 */

const API = process.env.API_URL || 'http://localhost:3001/api';
const BOT_COUNT = parseInt(process.argv[2]) || 3;

// Действия и их веса (вероятность)
const ACTIONS = {
  pve:       { weight: 25, cooldown: 300 },  // атака моба
  pvp:       { weight: 10, cooldown: 300 },  // атака игрока
  job:       { weight: 20, cooldown: 600 },  // работа
  shop_buy:  { weight: 10, cooldown: 120 },  // покупка в магазине
  auction:   { weight: 15, cooldown: 60  },  // аукцион (ставка/покупка)
  craft:     { weight: 10, cooldown: 120 },  // крафт
  rest:      { weight: 10, cooldown: 120 },  // отдых в таверне
};

const COLORS = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m',
};

function log(botId, color, msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`${COLORS.dim}${ts}${COLORS.reset} ${color}[Бот#${botId}]${COLORS.reset} ${msg}`);
}

async function apiCall(token, method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `${res.status}`);
  return data;
}

// ─── Регистрация бота ───
async function registerBot(id) {
  log(id, COLORS.cyan, 'Регистрация...');
  const res = await fetch(`${API}/guest`, { method: 'POST' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  log(id, COLORS.green, `Зарегистрирован: ${data.user.username} (id=${data.user.id})`);
  return { token: data.token, userId: data.user.id, username: data.user.username };
}

// ─── Получить персонажа ───
async function getCharacter(token) {
  const res = await fetch(`${API}/character/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

// ─── PvE ───
async function doPve(token, botId) {
  // Получаем список мобов
  const mobsRes = await fetch(`${API}/mobs`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const mobs = await mobsRes.json();
  if (!mobs.length) { log(botId, COLORS.yellow, 'Нет мобов'); return false; }

  // Выбираем моба по уровню (60% шанс равного, 30% слабее, 10% сильнее)
  const char = await getCharacter(token);
  const lvl = char.level || 1;
  const r = Math.random();
  let pool;
  if (r < 0.6) pool = mobs.filter(m => m.level === lvl);
  else if (r < 0.9) pool = mobs.filter(m => m.level < lvl);
  else pool = mobs.filter(m => m.level > lvl);
  if (!pool.length) pool = mobs;

  const mob = pool[Math.floor(Math.random() * pool.length)];
  try {
    const result = await apiCall(token, 'POST', '/mob/attack', { mobId: mob.id });
    const won = result.playerWon;
    log(botId, won ? COLORS.green : COLORS.red,
      `PvE: ${mob.name} (ур.${mob.level}) — ${won ? 'ПОБЕДА' : 'поражение'}` +
      (won && result.goldGained ? ` +${result.goldGained}🥇` : '') +
      (won && result.materialDropped ? ` +${result.materialDropped.name}` : ''));
    return true;
  } catch (e) {
    log(botId, COLORS.red, `PvE ошибка: ${e.message}`);
    return false;
  }
}

// ─── PvP ───
async function doPvp(token, botId) {
  try {
    const result = await apiCall(token, 'POST', '/battle', { opponentId: null });
    const won = result.winnerId > 0; // упрощённо
    log(botId, won ? COLORS.green : COLORS.red,
      `PvP: vs ${result.opponent?.name || '???'} — ${result.hpAfter > 0 ? 'ПОБЕДА' : 'поражение'}` +
      (result.moneyStolen ? ` ±${result.moneyStolen}🥇` : ''));
    return true;
  } catch (e) {
    // Кулдаун или нет соперников — ок
    if (e.message.includes('осталось') || e.message.includes('соперник') || e.message.includes('здоровья')) {
      log(botId, COLORS.dim, `PvP: ${e.message}`);
      return false;
    }
    log(botId, COLORS.red, `PvP ошибка: ${e.message}`);
    return false;
  }
}

// ─── Работа ───
async function doJob(token, botId) {
  try {
    const durations = [600, 1800, 3600];
    const dur = durations[Math.floor(Math.random() * durations.length)];
    const result = await apiCall(token, 'POST', '/jobs/start-random', { duration: dur });
    log(botId, COLORS.cyan, `Работа: ${result.job?.name || '???'} на ${dur} сек`);
    return true;
  } catch (e) {
    log(botId, COLORS.dim, `Работа: ${e.message}`);
    return false;
  }
}

// ─── Магазин ───
async function doShopBuy(token, botId) {
  try {
    const char = await getCharacter(token);
    const shopRes = await fetch(`${API}/shop/items`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const items = await shopRes.json();
    if (!items.length) return false;

    // Фильтруем по деньгам
    const affordable = items.filter(i => (i.price || 999999) <= char.money * 0.6);
    if (!affordable.length) { log(botId, COLORS.dim, 'Магазин: нет денег'); return false; }

    const item = affordable[Math.floor(Math.random() * affordable.length)];
    await apiCall(token, 'POST', '/shop/buy', { itemId: item.id });
    log(botId, COLORS.green, `Магазин: купил ${item.name} за ${item.price}🥇`);
    return true;
  } catch (e) {
    log(botId, COLORS.yellow, `Магазин: ${e.message}`);
    return false;
  }
}

// ─── Аукцион ───
async function doAuction(token, botId) {
  try {
    const char = await getCharacter(token);
    const aucRes = await fetch(`${API}/auction`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const lots = await aucRes.json();
    if (!lots.length) {
      // Нет лотов — может выставить свой?
      log(botId, COLORS.dim, 'Аукцион: нет лотов');
      return false;
    }

    const r = Math.random();
    const lot = lots[Math.floor(Math.random() * lots.length)];
    if (lot.sellerId === char.id) return false; // не свой лот

    if (r < 0.6) {
      // Сделать ставку
      const minBid = lot.currentBid
        ? lot.currentBid + Math.max(1, Math.floor(lot.currentBid * 0.05))
        : lot.startPrice;
      if (minBid > char.money * 0.5) { log(botId, COLORS.dim, 'Аукцион: дорого'); return false; }

      await apiCall(token, 'POST', '/auction/bid', { lotId: lot.id, amount: minBid });
      log(botId, COLORS.green, `Аукцион: ставка ${minBid}🥇 на ${JSON.parse(lot.itemData).name || 'лот'}`);
    } else if (lot.buyoutPrice && lot.buyoutPrice <= char.money * 0.5) {
      // Выкуп
      await apiCall(token, 'POST', '/auction/buyout', { lotId: lot.id });
      log(botId, COLORS.green, `Аукцион: выкуп за ${lot.buyoutPrice}🥇`);
    }
    return true;
  } catch (e) {
    log(botId, COLORS.yellow, `Аукцион: ${e.message}`);
    return false;
  }
}

// ─── Крафт ───
async function doCraft(token, botId) {
  try {
    const recipesRes = await fetch(`${API}/craft/recipes`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const recipes = await recipesRes.json();
    if (!recipes.length) return false;

    // Проверяем, может ли бот скрафтить что-то
    for (let attempt = 0; attempt < 5; attempt++) {
      const recipe = recipes[Math.floor(Math.random() * recipes.length)];
      try {
        const result = await apiCall(token, 'POST', '/craft/craft', { recipeId: recipe.id });
        log(botId, COLORS.green, `Крафт: ${recipe.name || 'рецепт'} ✓`);
        return true;
      } catch (e) {
        if (!e.message.includes('Недостаточно') && !e.message.includes('ингредиент')) {
          log(botId, COLORS.yellow, `Крафт: ${e.message}`);
          return false;
        }
      }
    }
    log(botId, COLORS.dim, 'Крафт: нет ингредиентов');
    return false;
  } catch (e) {
    log(botId, COLORS.dim, `Крафт: ${e.message}`);
    return false;
  }
}

// ─── Отдых в таверне (лечение) ───
async function doRest(token, botId) {
  try {
    const tavernRes = await fetch(`${API}/tavern`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const tavern = await tavernRes.json();
    const missingHp = tavern.maxHp - tavern.currentHp;
    if (missingHp <= 0) { log(botId, COLORS.dim, 'Таверна: HP полное'); return false; }
    if (tavern.money < missingHp * 2) { log(botId, COLORS.dim, 'Таверна: нет денег на лечение'); return false; }

    await apiCall(token, 'POST', '/tavern/heal', { full: Math.random() > 0.5 });
    log(botId, COLORS.cyan, `Таверна: лечение (нехватка ${missingHp} HP)`);
    return true;
  } catch (e) {
    log(botId, COLORS.dim, `Таверна: ${e.message}`);
    return false;
  }
}

// ─── Выбор действия ───
function pickAction(cooldowns) {
  const now = Date.now() / 1000;
  const available = Object.entries(ACTIONS)
    .filter(([name]) => !cooldowns[name] || cooldowns[name] <= now)
    .map(([name, cfg]) => ({ name, weight: cfg.weight }));

  if (!available.length) return 'rest';

  const total = available.reduce((s, a) => s + a.weight, 0);
  let r = Math.random() * total;
  for (const a of available) {
    r -= a.weight;
    if (r <= 0) return a.name;
  }
  return available[available.length - 1].name;
}

// ─── Главный цикл бота ───
async function botLoop(id, token, userId) {
  const cooldowns = {};
  const actionMap = { pve: doPve, pvp: doPvp, job: doJob, shop_buy: doShopBuy, auction: doAuction, craft: doCraft, rest: doRest };

  while (true) {
    const action = pickAction(cooldowns);
    const fn = actionMap[action];
    if (fn) {
      try {
        await fn(token, id);
      } catch (e) {
        // молча
      }
      cooldowns[action] = Date.now() / 1000 + ACTIONS[action].cooldown;
    }

    // Пауза 5-30 секунд между действиями
    const delay = 5000 + Math.random() * 25000;
    await new Promise(r => setTimeout(r, delay));
  }
}

// ─── Запуск ───
async function main() {
  console.log(`${COLORS.cyan}=== Запуск ${BOT_COUNT} ботов ===${COLORS.reset}`);

  const bots = [];
  for (let i = 1; i <= BOT_COUNT; i++) {
    try {
      const bot = await registerBot(i);
      bots.push(bot);
    } catch (e) {
      console.error(`${COLORS.red}Ошибка регистрации бота #${i}: ${e.message}${COLORS.reset}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`${COLORS.green}Зарегистрировано ${bots.length} ботов${COLORS.reset}`);

  // Запускаем параллельно
  bots.forEach((b, idx) => {
    botLoop(idx + 1, b.token, b.userId);
  });
}

main().catch(e => {
  console.error(`${COLORS.red}Фатальная ошибка: ${e.message}${COLORS.reset}`);
  process.exit(1);
});
