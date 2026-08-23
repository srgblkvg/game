import { db } from '../db/index';

// Таблица казны замка — одна строка
export async function initTreasury() {
    const rows = await db.raw('SELECT id, amount, updated_at FROM castle_treasury ORDER BY id');
    const readiness = await db.raw(`
        SELECT
            (
                SELECT jsonb_agg(
                    jsonb_build_array(column_name, data_type, is_nullable, COALESCE(column_default, ''))
                    ORDER BY ordinal_position
                )
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'castle_treasury'
            ) = '[
                ["id", "integer", "NO", "1"],
                ["amount", "integer", "NO", "0"],
                ["updated_at", "timestamp with time zone", "YES", "now()"]
            ]'::jsonb
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'castle_treasury'::regclass
                  AND contype = 'p'
                  AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
            )
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'castle_treasury'::regclass
                  AND contype = 'c'
                  AND convalidated = true
                  AND pg_get_constraintdef(oid) = 'CHECK ((id = 1))'
            )
            AND has_table_privilege(current_user, 'castle_treasury', 'SELECT')
            AND has_table_privilege(current_user, 'castle_treasury', 'UPDATE')
            AS ready
    `);
    if (rows.rowCount !== 1 || Number(rows.rows[0]?.id) !== 1 || readiness.rows[0]?.ready !== true) {
        throw new Error('treasury schema readiness failed');
    }
}

export async function addToTreasury(amount: number, source: string) {
    if (!amount || amount <= 0) return;
    await db.run('UPDATE castle_treasury SET amount = amount + ?, updated_at = NOW() WHERE id = 1', [amount]);
    await db.run('INSERT INTO treasury_log (amount, source, created_at) VALUES (?, ?, NOW())', [amount, source]);
}

export async function deductFromTreasury(amount: number, source: string) {
    if (!amount || amount <= 0) return;
    await db.run('UPDATE castle_treasury SET amount = amount - ?, updated_at = NOW() WHERE id = 1', [amount]);
    await db.run('INSERT INTO treasury_log (amount, source, created_at) VALUES (?, ?, NOW())', [-amount, source]);
}

export async function getTreasury(): Promise<number> {
    const row = await db.one('SELECT amount FROM castle_treasury WHERE id = 1') as any;
    return row?.amount || 0;
}

// Инициализация логов
export async function initTreasuryLog() {
    await db.raw('SELECT id, amount, source, created_at FROM treasury_log LIMIT 0');
    const readiness = await db.raw(`
        SELECT
            (
                SELECT jsonb_agg(
                    jsonb_build_array(column_name, data_type, is_nullable, COALESCE(column_default, ''))
                    ORDER BY ordinal_position
                )
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'treasury_log'
            ) = '[
                ["id", "integer", "NO", "nextval(''treasury_log_id_seq''::regclass)"],
                ["amount", "integer", "NO", ""],
                ["source", "text", "NO", ""],
                ["created_at", "timestamp with time zone", "YES", "now()"]
            ]'::jsonb
            AND EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conrelid = 'treasury_log'::regclass
                  AND contype = 'p'
                  AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id)'
            )
            AND has_table_privilege(current_user, 'treasury_log', 'SELECT')
            AND has_table_privilege(current_user, 'treasury_log', 'INSERT')
            AND has_sequence_privilege(current_user, 'treasury_log_id_seq', 'USAGE')
            AS ready
    `);
    if (readiness.rows[0]?.ready !== true) {
        throw new Error('treasury log schema readiness failed');
    }
}
