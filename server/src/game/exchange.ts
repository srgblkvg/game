import { db } from '../db/index';
import { getTreasury } from './treasury';

// Золотой резерв биржи — одна строка
export async function initExchange() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS exchange_gold (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            amount INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    const existing = await db.one('SELECT id FROM exchange_gold WHERE id = 1') as any;
    if (!existing) {
        await db.run('INSERT INTO exchange_gold (id, amount) VALUES (1, 28000)');
    }

    // Таблица истории курса (каждая сделка)
    await db.run(`
        CREATE TABLE IF NOT EXISTS exchange_history (
            id SERIAL PRIMARY KEY,
            price INTEGER NOT NULL,
            silver INTEGER NOT NULL,
            gold INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

// Записать сделку в историю
export async function recordTrade(price: number, silver: number, gold: number) {
    try {
        await db.run(
            'INSERT INTO exchange_history (price, silver, gold, created_at) VALUES (?, ?, ?, NOW())',
            [price, silver, gold]
        );
    } catch { /* тихо */ }
}

export async function getGoldReserve(): Promise<number> {
    const row = await db.one('SELECT amount FROM exchange_gold WHERE id = 1') as any;
    return row?.amount || 0;
}

export async function updateGoldReserve(delta: number) {
    await db.run('UPDATE exchange_gold SET amount = amount + ?, updated_at = NOW() WHERE id = 1', [delta]);
}

// sell_coef в зависимости от казны
export function getSellCoef(treasurySilver: number): number {
    if (treasurySilver < 500_000) return 0;
    if (treasurySilver < 1_500_000) return (treasurySilver - 500_000) / 1_000_000;
    return 1;
}

// AMM: покупка dx золота → сколько серебра заплатить
export function calcBuyCost(dx: number, R_silver: number, R_gold: number): number {
    if (dx <= 0 || dx >= R_gold) return Infinity;
    const newSilver = (R_silver * R_gold) / (R_gold - dx);
    return newSilver - R_silver;
}

// AMM: продажа dx золота → сколько серебра получить
export function calcSellPayout(dx: number, R_silver: number, R_gold: number): number {
    if (dx <= 0) return 0;
    const newSilver = (R_silver * R_gold) / (R_gold + dx);
    return R_silver - newSilver;
}
