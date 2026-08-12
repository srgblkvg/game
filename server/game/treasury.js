"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTreasury = initTreasury;
exports.addToTreasury = addToTreasury;
exports.getTreasury = getTreasury;
exports.initTreasuryLog = initTreasuryLog;
const index_1 = require("../db/index");
// Таблица казны замка — одна строка
async function initTreasury() {
    await index_1.db.run(`
        CREATE TABLE IF NOT EXISTS castle_treasury (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            amount INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    // Убедимся что строка существует
    const existing = await index_1.db.one('SELECT id FROM castle_treasury WHERE id = 1');
    if (!existing) {
        await index_1.db.run('INSERT INTO castle_treasury (id, amount) VALUES (1, 0)');
    }
}
async function addToTreasury(amount, source) {
    if (!amount || amount <= 0)
        return;
    await index_1.db.run('UPDATE castle_treasury SET amount = amount + ?, updated_at = NOW() WHERE id = 1', [amount]);
    await index_1.db.run('INSERT INTO treasury_log (amount, source, created_at) VALUES (?, ?, NOW())', [amount, source]);
}
async function getTreasury() {
    const row = await index_1.db.one('SELECT amount FROM castle_treasury WHERE id = 1');
    return row?.amount || 0;
}
// Инициализация логов
async function initTreasuryLog() {
    await index_1.db.run(`
        CREATE TABLE IF NOT EXISTS treasury_log (
            id SERIAL PRIMARY KEY,
            amount INTEGER NOT NULL,
            source TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}
//# sourceMappingURL=treasury.js.map