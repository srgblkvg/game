const { Pool } = require("pg");
const pool = new Pool({ host: "localhost", user: "game", password: "game123", database: "game" });

function pgLower(sql) {
  const strs = [];
  let c = sql.replace(/'[^']*'/g, m => { strs.push(m); return '__S' + (strs.length - 1) + '__'; });
  c = c.replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, m => m.toLowerCase());
  return c.replace(/__S(\d+)__/g, (_, i) => strs[parseInt(i)]);
}

function pgParams(sql) { let i = 0; return sql.replace(/\?/g, () => '$' + (++i)); }

function camelRows(rows) {
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (typeof row[key] === 'string' && /^\d+$/.test(row[key])) {
        const n = parseInt(row[key], 10);
        if (n > 2147483647 || /^(id|count|level|cnt|total|sum|amount|price|cost|fee|rate|score|elo|rating|hp|exp|gold|money|slots|points|duration|chance|round|year|month|day|hour|min|sec|limit|offset|page|rank)$/i.test(key)) {
          row[key] = n;
        }
      }
    }
    const nullFields = ['inventory', 'equipment', 'activejob', 'openprivatetabs', 'snapshot', 'log', 'item_data', 'bonuses', 'extra'];
    for (const k of nullFields) { if (row[k] === null) row[k] = ''; }
    if (row.inventory === '') row.inventory = '[]';
    if (row.equipment === '') row.equipment = '{}';
    if (row.inventory === null) row.inventory = '[]';
    if (row.equipment === null) row.equipment = '{}';

    for (const key of Object.keys(row)) {
      let cc = key.replace(
        /(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid|data|wins|losses|pvp|bankvisit|max|min|job|order|image|chance|battles|money|created|upgraded|broken|seconds|xp|end|start|elo|score|number|players|ticket|stats|place|tag|text|chat|from|guild|role|last|first|ip|url|path|size|width|height|color|tier|slot|icon|attacked|made)$/i,
        m => m.charAt(0).toUpperCase() + m.slice(1)
      );
      cc = cc.replace(/attacktime$/i, 'AttackTime')
        .replace(/pveattacktime$/i, 'PveAttackTime')
        .replace(/attacksec$/i, 'AttackSec')
        .replace(/pveattacksec$/i, 'PveAttackSec')
        .replace(/taxrate$/i, 'TaxRate')
        .replace(/verified$/i, 'Verified')
        .replace(/hpupdate$/i, 'HpUpdate')
        .replace(/^bases$/i, 'baseS').replace(/^basea$/i, 'baseA')
        .replace(/^based$/i, 'baseD').replace(/^basem$/i, 'baseM')
        .replace(/^statpoints$/i, 'statPoints')
        .replace(/^totalbattles$/i, 'totalBattles')
        .replace(/^pvetotalbattles$/i, 'pveTotalBattles')
        .replace(/^pvewins$/i, 'pveWins')
        .replace(/^totalpvpmoneywon$/i, 'totalPvpMoneyWon')
        .replace(/^totalpvpmoneylost$/i, 'totalPvpMoneyLost')
        .replace(/^totalpvemoneywon$/i, 'totalPveMoneyWon')
        .replace(/^totalpvemoneylost$/i, 'totalPveMoneyLost')
        .replace(/^totaljobmoney$/i, 'totalJobMoney')
        .replace(/^totaljobseconds$/i, 'totalJobSeconds')
        .replace(/^craftcreated$/i, 'craftCreated')
        .replace(/^craftupgraded$/i, 'craftUpgraded')
        .replace(/^craftbroken$/i, 'craftBroken')
        .replace(/^tournamentcount$/i, 'tournamentCount')
        .replace(/^tournamentwins$/i, 'tournamentWins')
        .replace(/^auctiontrades$/i, 'auctionTrades')
        .replace(/^emailverified$/i, 'emailVerified')
        .replace(/^isguest$/i, 'isGuest')
        .replace(/([a-z])guildid$/i, '$1GuildId')
        .replace(/^oauthprovider$/i, 'oauthProvider')
        .replace(/^oauthid$/i, 'oauthId')
        .replace(/^rewardxp$/i, 'rewardXp')
        .replace(/^accountnumber$/i, 'accountNumber')
        .replace(/^arenatopponentid$/i, 'arenaOpponentId')
        .replace(/lastattackedat$/i, 'lastAttackedAt');
      if (cc !== key) row[cc] = row[key];
    }
  }
  return rows;
}

(async () => {
  const sql = "SELECT tp.*, u.username, u.level, u.money, u.baseS, u.baseA, u.baseD, u.baseM, u.equipment, u.currentHp, u.statPoints, u.tournamentElo FROM tournament_participants tp JOIN users u ON tp.userId = u.id WHERE tp.tournamentId = ? ORDER BY u.tournamentElo ASC";
  const q = pgParams(pgLower(sql));
  const r = await pool.query(q, [639]);
  const rows = camelRows(r.rows);
  console.log("Count:", rows.length);
  rows.forEach(p => {
    console.log("  userId:", p.userId, "username:", p.username, "tournamentId:", p.tournamentId);
    console.log("  Keys:", Object.keys(p).filter(k => k !== k.toLowerCase()).join(", "));
  });
  pool.end();
})().catch(e => console.error(e));