import { Pool, PoolClient } from 'pg';
declare const pool: Pool;
export declare const db: {
    /** Query multiple rows - returns array with camelCase keys */
    query(sql: string, params?: any[]): Promise<any[]>;
    /** Query one row - returns row with camelCase keys or null */
    one(sql: string, params?: any[]): Promise<any | null>;
    /** Execute INSERT/UPDATE/DELETE - returns { changes, lastInsertRowid } */
    run(sql: string, params?: any[]): Promise<{
        changes: number;
        lastInsertRowid: number;
    }>;
    /** Raw pool.query - no camelCase, no ? conversion. For special cases. */
    raw(sql: string, params?: any[]): Promise<import("pg").QueryResult<any>>;
    /** Transaction with client passed to callback */
    tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
};
export { pool };
//# sourceMappingURL=index.d.ts.map