import { db } from '../db/index';

// Резервы биржи — одна строка
export async function initExchange() {
    await db.run(`
        CREATE TABLE IF NOT EXISTS exchange_reserves (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
            silver INTEGER NOT NULL DEFAULT 0,
            gold INTEGER NOT NULL DEFAULT 0,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);
    const existing = await db.one('SELECT id FROM exchange_reserves WHERE id = 1') as any;
    if (!existing) {
        // Стартовые резервы: 42 500 000 серебра, 28 000 золота → цена ~1518
        await db.run('INSERT INTO exchange_reserves (id, silver, gold) VALUES (1, 42500000, 28000)');
    }
}

// Получить текущие резервы
export async function getReserves(): Promise<{ silver: number; gold: number }> {
    const row = await db.one('SELECT silver, gold FROM exchange_reserves WHERE id = 1') as any;
    return { silver: row?.silver || 0, gold: row?.gold || 0 };
}

// Обновить резервы (атомарно)
export async function updateReserves(silverDelta: number, goldDelta: number) {
    await db.run(
        'UPDATE exchange_reserves SET silver = silver + ?, gold = gold + ?, updated_at = NOW() WHERE id = 1',
        [silverDelta, goldDelta]
    );
}

// Получить sell_coef в зависимости от казны
export function getSellCoef(treasurySilver: number): number {
    if (treasurySilver < 500_000) return 0;
    if (treasurySilver < 1_500_000) return (treasurySilver - 500_000) / 1_000_000;
    return 1;
}

// AMM: покупка игроком dx золота → сколько серебра нужно заплатить
export function calcBuyCost(dx: number, R_silver: number, R_gold: number): number {
    // dy = (R_silver * R_gold) / (R_gold - dx) - R_silver
    const newSilver = (R_silver * R_gold) / (R_gold - dx);
    return newSilver - R_silver;
}

// AMM: продажа игроком dx золота → сколько серебра получит
export function calcSellPayout(dx: number, R_silver: number, R_gold: number): number {
    // dy = R_silver - (R_silver * R_gold) / (R_gold + dx)
    const newSilver = (R_silver * R_gold) / (R_gold + dx);
    return R_silver - newSilver;
}
