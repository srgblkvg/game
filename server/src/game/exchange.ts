import { db } from '../db/index';
import { getTreasury } from './treasury';

// Золотой резерв биржи — одна строка
export async function initExchange() {
    const reserve = await db.raw('SELECT id, amount, updated_at FROM exchange_gold ORDER BY id');
    await db.raw('SELECT id, price, silver, gold, created_at FROM exchange_history LIMIT 0');
    const readiness = await db.raw(`
        SELECT
            (
                SELECT jsonb_agg(
                    jsonb_build_array(column_name, data_type, is_nullable, COALESCE(column_default, ''))
                    ORDER BY ordinal_position
                )
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'exchange_gold'
            ) = '[
                ["id", "integer", "NO", "1"],
                ["amount", "integer", "NO", "0"],
                ["updated_at", "timestamp with time zone", "YES", "now()"]
            ]'::jsonb
            AND (
                SELECT jsonb_agg(
                    jsonb_build_array(column_name, data_type, is_nullable, COALESCE(column_default, ''))
                    ORDER BY ordinal_position
                )
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'exchange_history'
            ) = '[
                ["id", "integer", "NO", "nextval(''exchange_history_id_seq''::regclass)"],
                ["price", "integer", "NO", ""],
                ["silver", "integer", "NO", ""],
                ["gold", "integer", "NO", ""],
                ["created_at", "timestamp with time zone", "YES", "now()"]
            ]'::jsonb
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'exchange_gold'::regclass
                  AND contype = 'p'
                  AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
            )
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'exchange_gold'::regclass
                  AND contype = 'c'
                  AND convalidated = true
                  AND pg_get_constraintdef(oid) = 'CHECK ((id = 1))'
            )
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'exchange_history'::regclass
                  AND contype = 'p'
                  AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
            )
            AND has_table_privilege(current_user, 'exchange_gold', 'SELECT')
            AND has_table_privilege(current_user, 'exchange_gold', 'UPDATE')
            AND has_table_privilege(current_user, 'exchange_history', 'SELECT')
            AND has_table_privilege(current_user, 'exchange_history', 'INSERT')
            AND has_sequence_privilege(current_user, 'exchange_history_id_seq', 'USAGE')
            AS ready
    `);
    if (reserve.rowCount !== 1 || Number(reserve.rows[0]?.id) !== 1 || readiness.rows[0]?.ready !== true) {
        throw new Error('exchange schema readiness failed');
    }
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
