import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE || 'game',
  user: process.env.PGUSER || 'game',
  password: process.env.PGPASSWORD || 'game123',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Transform camelCase SQL identifiers to lowercase for PostgreSQL
// PG is case-sensitive for unquoted identifiers (folds to lowercase).
// SQLite was case-insensitive. This finds camelCase words in SQL
// (column refs, table aliases) and lowercases them, preserving string literals.
function pgLowerIdentifiers(sql: string): string {
  // Temporarily remove single-quoted string literals to avoid corrupting data
  const strings: string[] = [];
  let cleaned = sql.replace(/'[^']*'/g, (m) => {
    strings.push(m);
    return '__STR_' + (strings.length - 1) + '__';
  });

  // Replace camelCase words (lowercase letter followed by uppercase) with lowercase
  cleaned = cleaned.replace(/\b([a-z]+[A-Z][a-zA-Z0-9]*)\b/g, (m) => m.toLowerCase());

  // Restore string literals
  return cleaned.replace(/__STR_(\d+)__/g, (_, i) => strings[parseInt(i)]!);
}

// Suffix-based camelCase converter - adds camelCase keys for common patterns
// PG lowercases all unquoted identifiers -> we rebuild camelCase from lowercase
function camelRows(rows: any[]): any[] {
  for (const row of rows) {
    // Convert PG bigint strings to numbers (only if > 2^31 - actual bigints from COUNT/SUM)
    for (const key of Object.keys(row)) {
      if (typeof row[key] === 'string' && /^\d+$/.test(row[key])) {
        const n = parseInt(row[key], 10);
        if (n > 2147483647 || /^(id|count|level|cnt|total|sum|amount|price|cost|fee|rate|score|elo|rating|hp|exp|gold|money|slots|points|duration|chance|round|year|month|day|hour|min|sec|limit|offset|page|rank)$/i.test(key)) {
          row[key] = n;
        }
      }
    }
    const nullFields = ['inventory','equipment','activejob','openprivatetabs','snapshot',
      'log','item_data','bonuses','extra'];
    for (const k of nullFields) {
      if (row[k] === null) row[k] = '';
    }
    // Special: inventory defaults to '[]', equipment to '{}'
    if (row.inventory === '') row.inventory = '[]';
    if (row.equipment === '') row.equipment = '{}';
    // Re-apply after null checks
    if (row.inventory === null) row.inventory = '[]';
    if (row.equipment === null) row.equipment = '{}';

    for (const key of Object.keys(row)) {
      let cc = key.replace(
        /(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid|data|wins|losses|pvp|bankvisit|max|min|job|order|image|chance|battles|money|created|upgraded|broken|seconds|xp|end|start|elo|score|number|players|ticket|stats|place|tag|text|chat|from|guild|role|last|first|ip|url|path|size|width|height|color|tier|slot|icon|attacked|made|round|log|code|expires|verified|drink|date|bid|by|completed)$/i,
        m => m.charAt(0).toUpperCase() + m.slice(1)
      );
      cc = cc.replace(/attacktime$/i, 'AttackTime')
             .replace(/pveattacktime$/i, 'PveAttackTime')
             .replace(/attacksec$/i, 'AttackSec')
             .replace(/pveattacksec$/i, 'PveAttackSec')
             .replace(/taxrate$/i, 'taxRate')
             .replace(/verified$/i, 'Verified')
             .replace(/hpupdate$/i, 'HpUpdate')
             .replace(/^bases$/i, 'baseS').replace(/^basea$/i, 'baseA')
             .replace(/^based$/i, 'baseD').replace(/^basem$/i, 'baseM')
             .replace(/^statpoints$/i, 'statPoints')
             .replace(/lastloginat$/i, 'lastLoginAt')
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
             .replace(/^emailcode$/i, 'emailCode')
             .replace(/^emailcodeexpires$/i, 'emailCodeExpires')
             .replace(/^isguest$/i, 'isGuest')
             .replace(/([a-z])guildid$/i, '$1GuildId')
             .replace(/lastattackedat$/i, "lastAttackedAt")
             .replace(/^oauthprovider$/i, 'oauthProvider')
             .replace(/^oauthid$/i, 'oauthId')
             .replace(/^rewardxp$/i, 'rewardXp')
             .replace(/^accountnumber$/i, 'accountNumber')
             .replace(/^fromaccount$/i, 'fromAccount')
             .replace(/^toaccount$/i, 'toAccount')
             .replace(/^currentbidderid$/i, 'currentBidderId')
             .replace(/^currentbiddername$/i, 'currentBidderName')
             .replace(/^attackerguildid$/i, 'attackerGuildId')
             .replace(/^defenderguildid$/i, 'defenderGuildId')
             .replace(/^arenatopponentid$/i, 'arenaOpponentId')
             .replace(/^tutorial_completed$/i, 'tutorialCompleted');
      if (cc !== key) row[cc] = row[key];
    }
  }
  return rows;
}

// Convert ? placeholders to $1, $2, ...
function pgParams(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + (++i));
}

export const db = {
  /** Query multiple rows - returns array with camelCase keys */
  async query(sql: string, params?: any[]): Promise<any[]> {
    const q = pgParams(pgLowerIdentifiers(sql));
    const r = await pool.query(q, params || []);
    return camelRows(r.rows);
  },

  /** Query one row - returns row with camelCase keys or null */
  async one(sql: string, params?: any[]): Promise<any | null> {
    const rows = await db.query(sql, params);
    return rows[0] || null;
  },

  /** Execute INSERT/UPDATE/DELETE - returns { changes, lastInsertRowid } */
  async run(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const q = pgParams(pgLowerIdentifiers(sql));
    const isInsert = /^\s*INSERT\s+/i.test(q);
    if (isInsert) {
      // Try to get RETURNING id, but gracefully handle tables without 'id' column
      try {
        const returningQuery = q.replace(/;?\s*$/, '') + ' RETURNING id';
        const r = await pool.query(returningQuery, params || []);
        return { changes: r.rowCount || 0, lastInsertRowid: r.rows[0]?.id || 0 };
      } catch {
        // Table has no 'id' column (composite key) - fall back to simple insert
        const r = await pool.query(q, params || []);
        return { changes: r.rowCount || 0, lastInsertRowid: 0 };
      }
    }
    const r = await pool.query(q, params || []);
    return { changes: r.rowCount || 0, lastInsertRowid: 0 };
  },

  /** Raw pool.query - no camelCase, no ? conversion. For special cases. */
  async raw(sql: string, params?: any[]) {
    return pool.query(sql, params || []);
  },

  /** Transaction with client passed to callback */
  async tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },
};

export { pool };
