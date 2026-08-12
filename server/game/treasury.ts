import { db } from '../db/index';

// Таблица казны замка — одна строка
export async function initTreasury() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS castle_treasury (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            amount INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    // Убедимся что строка существует
    const existing = await db.one('SELECT id FROM castle_treasury WHERE id = 1') as any;
    if (!existing) {
        await db.run('INSERT INTO castle_treasury (id, amount) VALUES (1, 0)');
    }
}

export async function addToTreasury(amount: number, source: string) {
    if (!amount || amount <= 0) return;
    await db.run('UPDATE castle_treasury SET amount = amount + ?, updated_at = NOW() WHERE id = 1', [amount]);
    await db.run('INSERT INTO treasury_log (amount, source, created_at) VALUES (?, ?, NOW())', [amount, source]);
}

export async function getTreasury(): Promise<number> {
    const row = await db.one('SELECT amount FROM castle_treasury WHERE id = 1') as any;
    return row?.amount || 0;
}

// Инициализация логов
export async function initTreasuryLog() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS treasury_log (
            id SERIAL PRIMARY KEY,
            amount INTEGER NOT NULL,
            source TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}
