import { executeInTransaction, type TransactionExecutor } from './transaction';

export interface TransactionQueryClient {
  query(sql: string): Promise<unknown>;
}

export interface TransactionClient extends TransactionQueryClient {
  release(): void;
}

/** Adapts a node-postgres client to the reviewed transaction lifecycle seam. */
export function poolClientTransactionExecutor(
  client: TransactionQueryClient,
): TransactionExecutor {
  return {
    begin: () => client.query('BEGIN').then(() => undefined),
    commit: () => client.query('COMMIT').then(() => undefined),
    rollback: () => client.query('ROLLBACK').then(() => undefined),
  };
}

/** Runs a PoolClient callback while retaining release ownership in this adapter. */
export async function executeWithPoolClient<C extends TransactionClient, T>(
  client: C,
  callback: (client: C) => Promise<T>,
): Promise<T> {
  try {
    return await executeInTransaction(
      poolClientTransactionExecutor(client),
      () => callback(client),
    );
  } finally {
    client.release();
  }
}
