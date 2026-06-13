// rebuild-pg.ts — пересоздаёт таблицы в PG с правильными типами
import { Pool } from 'pg';

const pg = new Pool({
  host: process.env.PGHOST || '194.226.142.237',
  port: parseInt(process.env.PGPORT || '5432'),
  database: 'game',
  user: 'game',
  password: 'game123',
});

// Все timestamp колонки → TEXT (PG сам распарсит ISO строки)
// Все числовые → INTEGER или REAL
// Все id → INTEGER с автоинкрементом

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS rarities (
    id SERIAL PRIMARY KEY,
    display_name TEXT NOT NULL,
    color TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    slot TEXT NOT NULL,
    rarity_id INTEGER REFERENCES rarities(id),
    image TEXT,
    s INTEGER DEFAULT 0,
    a INTEGER DEFAULT 0,
    d INTEGER DEFAULT 0,
    m INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 0,
    crit INTEGER DEFAULT 0,
    dodge INTEGER DEFAULT 0,
    counter INTEGER DEFAULT 0,
    fullblock INTEGER DEFAULT 0,
    price INTEGER DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS craft_items (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    rarity_id INTEGER REFERENCES rarities(id),
    image TEXT,
    s INTEGER DEFAULT 0,
    a INTEGER DEFAULT 0,
    d INTEGER DEFAULT 0,
    m INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 0,
    crit INTEGER DEFAULT 0,
    dodge INTEGER DEFAULT 0,
    counter INTEGER DEFAULT 0,
    fullblock INTEGER DEFAULT 0,
    price INTEGER DEFAULT 0
  )`,
  // Skipping materials table for now — add if needed
  
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordhash TEXT NOT NULL DEFAULT '',
    email TEXT,
    emailverified INTEGER DEFAULT 0,
    emailcode TEXT,
    emailcodeexpires INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    money INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    totalbattles INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    bases INTEGER DEFAULT 5,
    basea INTEGER DEFAULT 5,
    based INTEGER DEFAULT 5,
    basem INTEGER DEFAULT 5,
    statpoints INTEGER DEFAULT 0,
    currenthp INTEGER DEFAULT 50,
    maxhp INTEGER DEFAULT 50,
    lasthpupdate INTEGER DEFAULT 0,
    lastattacktime INTEGER DEFAULT 0,
    lastpveattacktime INTEGER DEFAULT 0,
    protectionuntil INTEGER DEFAULT 0,
    inventoryslots INTEGER DEFAULT 10,
    inventory TEXT DEFAULT '[]',
    equipment TEXT DEFAULT '{}',
    activejob TEXT,
    activejobend INTEGER DEFAULT 0,
    activedrink TEXT,
    drinkuntil INTEGER DEFAULT 0,
    roomtype TEXT,
    roomuntil INTEGER DEFAULT 0,
    premiumuntil INTEGER DEFAULT 0,
    elo INTEGER DEFAULT 1000,
    seasonwins INTEGER DEFAULT 0,
    seasonlosses INTEGER DEFAULT 0,
    lastpvptime INTEGER DEFAULT 0,
    totalpvpMoneywon INTEGER DEFAULT 0,
    totalpvpMoneylost INTEGER DEFAULT 0,
    totaljobMoney INTEGER DEFAULT 0,
    totaljobSeconds INTEGER DEFAULT 0,
    gender TEXT DEFAULT 'male',
    isguest INTEGER DEFAULT 0,
    lastloginat INTEGER DEFAULT 0,
    failedlogins INTEGER DEFAULT 0,
    lockeduntil INTEGER DEFAULT 0,
    banneduntil INTEGER DEFAULT 0,
    chatbanneduntil INTEGER DEFAULT 0,
    openprivatetabs TEXT DEFAULT '[]',
    lastbankvisit INTEGER DEFAULT 0,
    avatar TEXT,
    guildid INTEGER DEFAULT 0,
    guildname TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    passwordhash TEXT NOT NULL,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS battles (
    id SERIAL PRIMARY KEY,
    attackerid INTEGER NOT NULL,
    defenderid INTEGER NOT NULL,
    winnerid INTEGER,
    log TEXT,
    steps INTEGER DEFAULT 0,
    attackerhpafter INTEGER,
    defenderhpafter INTEGER,
    expgained INTEGER DEFAULT 0,
    moneygained INTEGER DEFAULT 0,
    moneystolen INTEGER DEFAULT 0,
    type TEXT DEFAULT 'pvp',
    mobid INTEGER,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    senderid INTEGER NOT NULL,
    targetid INTEGER,
    content TEXT,
    item_data TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS guilds (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    tag TEXT,
    leaderid INTEGER NOT NULL,
    treasury INTEGER DEFAULT 0,
    taxrate INTEGER DEFAULT 5,
    description TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS guild_members (
    id SERIAL PRIMARY KEY,
    guildid INTEGER NOT NULL REFERENCES guilds(id),
    userid INTEGER NOT NULL REFERENCES users(id),
    role TEXT DEFAULT 'member',
    joinedat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS guild_invites (
    id SERIAL PRIMARY KEY,
    guildid INTEGER NOT NULL REFERENCES guilds(id),
    userid INTEGER NOT NULL REFERENCES users(id),
    fromuserid INTEGER,
    status TEXT DEFAULT 'pending',
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS guild_wars (
    id SERIAL PRIMARY KEY,
    attackerguildid INTEGER NOT NULL REFERENCES guilds(id),
    defenderguildid INTEGER NOT NULL REFERENCES guilds(id),
    status TEXT DEFAULT 'active',
    attackerscore INTEGER DEFAULT 0,
    defenderscore INTEGER DEFAULT 0,
    log TEXT,
    declaredat TEXT DEFAULT (now()::TEXT),
    expiresat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS guild_treasury_log (
    id SERIAL PRIMARY KEY,
    guildid INTEGER NOT NULL,
    userid INTEGER NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    division TEXT NOT NULL,
    status TEXT DEFAULT 'registration',
    registrationstart TEXT,
    registrationend TEXT,
    prizepool INTEGER DEFAULT 0,
    type TEXT DEFAULT 'official',
    creatorid INTEGER,
    entryfee INTEGER DEFAULT 0,
    name TEXT,
    minlevel INTEGER DEFAULT 1,
    maxlevel INTEGER DEFAULT 999,
    basepool INTEGER DEFAULT 0,
    completedat TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS tournament_participants (
    id SERIAL PRIMARY KEY,
    tournamentid INTEGER NOT NULL REFERENCES tournaments(id),
    userid INTEGER NOT NULL REFERENCES users(id),
    joinedat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS tournament_matches (
    id SERIAL PRIMARY KEY,
    tournamentid INTEGER NOT NULL REFERENCES tournaments(id),
    player1id INTEGER NOT NULL,
    player2id INTEGER NOT NULL,
    winnerid INTEGER,
    round INTEGER DEFAULT 1,
    log TEXT,
    completedat TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS daily_quests (
    id SERIAL PRIMARY KEY,
    userid INTEGER NOT NULL REFERENCES users(id),
    questtype TEXT NOT NULL,
    difficulty TEXT DEFAULT 'normal',
    requirement INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    rewardxp INTEGER DEFAULT 0,
    rewardmoney INTEGER DEFAULT 0,
    status TEXT DEFAULT 'available',
    snapshot TEXT,
    date TEXT NOT NULL,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS quest_history (
    id SERIAL PRIMARY KEY,
    userid INTEGER NOT NULL,
    questtype TEXT,
    difficulty TEXT,
    completedat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS job_history (
    id SERIAL PRIMARY KEY,
    userid INTEGER NOT NULL,
    jobid INTEGER,
    jobname TEXT,
    duration INTEGER,
    reward INTEGER,
    startedat TEXT,
    finishedat TEXT,
    premiumbonus INTEGER DEFAULT 0,
    xpgained INTEGER DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS login_logs (
    id SERIAL PRIMARY KEY,
    userid INTEGER,
    username TEXT,
    ip TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS feedback_messages (
    id SERIAL PRIMARY KEY,
    userid INTEGER,
    username TEXT,
    subject TEXT,
    message TEXT,
    createdat TEXT DEFAULT (now()::TEXT)
  )`,

  `CREATE TABLE IF NOT EXISTS seasons (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    startdate TEXT,
    enddate TEXT,
    status TEXT DEFAULT 'active'
  )`,

  `CREATE TABLE IF NOT EXISTS hall_of_fame (
    id SERIAL PRIMARY KEY,
    seasonid INTEGER REFERENCES seasons(id),
    userid INTEGER,
    username TEXT,
    elo INTEGER,
    rank INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    userid INTEGER NOT NULL REFERENCES users(id),
    itemname TEXT NOT NULL,
    slot TEXT NOT NULL,
    rarity_id INTEGER DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS collection_sets (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    bonus_percent INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0
  )`,

  `CREATE TABLE IF NOT EXISTS collection_set_items (
    id SERIAL PRIMARY KEY,
    set_id INTEGER NOT NULL REFERENCES collection_sets(id),
    item_name TEXT NOT NULL,
    slot TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS craft_recipes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    result_item_id INTEGER REFERENCES craft_items(id),
    result_rarity_id INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS craft_recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES craft_recipes(id),
    craft_item_id INTEGER REFERENCES craft_items(id),
    quantity INTEGER DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS shop_items (
    id SERIAL PRIMARY KEY,
    item_name TEXT NOT NULL,
    slot TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER DEFAULT -1,
    rarity_id INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS mobs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    hp INTEGER DEFAULT 100,
    s INTEGER DEFAULT 5,
    a INTEGER DEFAULT 5,
    d INTEGER DEFAULT 5,
    m INTEGER DEFAULT 5,
    xp INTEGER DEFAULT 10,
    gold INTEGER DEFAULT 5,
    image TEXT,
    rarity_id INTEGER
  )`,

  `CREATE TABLE IF NOT EXISTS mob_drops (
    id SERIAL PRIMARY KEY,
    mobid INTEGER REFERENCES mobs(id),
    itemname TEXT,
    itemtype TEXT,
    chance REAL DEFAULT 0.1,
    quantitymin INTEGER DEFAULT 1,
    quantitymax INTEGER DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS floors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    levelmin INTEGER DEFAULT 0,
    levelmax INTEGER DEFAULT 999,
    image TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    duration INTEGER DEFAULT 300,
    reward INTEGER DEFAULT 10,
    xpreward INTEGER DEFAULT 5,
    levelrequired INTEGER DEFAULT 1,
    image TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS drinks (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT,
    key TEXT UNIQUE,
    sbonus INTEGER DEFAULT 0,
    abonus INTEGER DEFAULT 0,
    dbonus INTEGER DEFAULT 0,
    mbonus INTEGER DEFAULT 0,
    hpbonus INTEGER DEFAULT 0,
    critbonus INTEGER DEFAULT 0,
    dodgebonus INTEGER DEFAULT 0,
    counterbonus INTEGER DEFAULT 0,
    fullblockbonus INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 3600,
    price INTEGER DEFAULT 50,
    image TEXT
  )`,
];

async function main() {
  for (const sql of SCHEMA) {
    try {
      await pg.query(sql);
      const name = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || '?';
      console.log('OK:', name);
    } catch (e: any) {
      console.log('ERR:', e.message.split('\n')[0].substring(0, 80));
    }
  }
  await pg.end();
  console.log('Done');
}

main();
