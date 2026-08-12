"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDB = initDB;
const pg_promise_1 = __importDefault(require("pg-promise"));
// CamelCase converter — adds camelCase keys alongside lowercase
function camelRows(rows) {
    for (const r of rows) {
        for (const k of Object.keys(r)) {
            // Replace null with empty string for JSON/text fields
            if (r[k] === null) {
                if (k === 'inventory') {
                    r[k] = '[]';
                    continue;
                }
                if (k === 'equipment') {
                    r[k] = '{}';
                    continue;
                }
                if (k === 'activejob' || k === 'openprivatetabs' || k === 'snapshot' ||
                    k === 'log' || k === 'item_data' || k === 'bonuses' || k === 'extra') {
                    r[k] = '';
                    continue;
                }
            }
            let cc = k.replace(/(hash|hp|id|until|at|time|name|type|count|level|slots|bonus|logins|amount|price|pool|fee|cost|won|lost|gained|rowid|data|wins|losses|pvp|hpupdate|bankvisit)$/i, m => m.charAt(0).toUpperCase() + m.slice(1));
            // Compound camelCase corrections
            cc = cc.replace(/attacktime$/i, 'AttackTime').replace(/pveattacktime$/i, 'PveAttackTime')
                .replace(/attacksec$/i, 'AttackSec').replace(/pveattacksec$/i, 'PveAttackSec')
                .replace(/taxrate$/i, 'TaxRate').replace(/verified$/i, 'Verified');
            if (cc !== k)
                r[cc] = r[k];
        }
    }
    return rows;
}
// ? → $N placeholder conversion
function convertPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}
const pgp = (0, pg_promise_1.default)();
const rawDb = pgp({
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    database: process.env.PGDATABASE || 'game',
    user: process.env.PGUSER || 'game',
    password: process.env.PGPASSWORD || 'game123',
    max: 20,
    error: (err, e) => {
        if (err.message && err.message.includes('NaN')) {
            console.error('[PG NaN] query:', e.query, 'params:', JSON.stringify(e.params));
        }
    },
});
// better-sqlite3-compatible wrapper
class Database {
    prepare(sql) {
        const q = convertPlaceholders(sql);
        return {
            get: (...params) => rawDb.manyOrNone(q, params).then((rows) => rows.length > 0 ? camelRows(rows)[0] : undefined),
            all: (...params) => rawDb.manyOrNone(q, params).then(camelRows),
            run: (...params) => {
                const isInsert = /^\s*INSERT\s+/i.test(q);
                const p = isInsert
                    ? rawDb.one(q.replace(/;?\s*$/, '') + ' RETURNING id', params).then((r) => ({ changes: 1, lastInsertRowid: r.id }))
                    : rawDb.result(q, params).then((r) => ({ changes: r.rowCount, lastInsertRowid: 0 }));
                return p.catch((err) => {
                    if (String(err.message).includes('NaN'))
                        console.error('[PG NaN RUN]', q, JSON.stringify(params));
                    throw err;
                });
            },
        };
    }
    exec(sql) { return rawDb.none(sql); }
    transaction(fn) {
        return rawDb.tx(async (t) => {
            const txDb = {
                prepare: (sql) => {
                    const q = convertPlaceholders(sql);
                    return {
                        get: (...params) => t.oneOrNone(q, params).then((r) => r ? camelRows([r])[0] : undefined),
                        all: (...params) => t.manyOrNone(q, params).then(camelRows),
                        run: (...params) => {
                            const isInsert = /^\s*INSERT\s+/i.test(q);
                            if (isInsert) {
                                const returningQ = q.replace(/;?\s*$/, '') + ' RETURNING id';
                                return t.one(returningQ, params).then((r) => ({ changes: 1, lastInsertRowid: r.id }));
                            }
                            return t.result(q, params).then((r) => ({ changes: r.rowCount, lastInsertRowid: 0 }));
                        },
                    };
                },
                exec: (sql) => t.none(sql),
            };
            return fn(txDb);
        });
    }
}
const db = new Database();
console.log('[PG] pg-promise ready');
async function initDB() { }
exports.default = db;
//# sourceMappingURL=index.js.map