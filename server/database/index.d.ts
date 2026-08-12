declare class Database {
    prepare(sql: string): {
        get: (...params: any[]) => Promise<any>;
        all: (...params: any[]) => Promise<any[]>;
        run: (...params: any[]) => any;
    };
    exec(sql: string): Promise<null>;
    transaction<T>(fn: (db: any) => Promise<T>): Promise<T>;
}
declare const db: Database;
export declare function initDB(): Promise<void>;
export default db;
//# sourceMappingURL=index.d.ts.map