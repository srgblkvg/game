export interface TransactionExecutor {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

/** Runs a callback inside the transaction lifecycle without coupling to a DB client. */
export async function executeInTransaction<T>(
  executor: TransactionExecutor,
  callback: () => Promise<T>,
): Promise<T> {
  await executor.begin();
  try {
    const result = await callback();
    await executor.commit();
    return result;
  } catch (error) {
    await executor.rollback();
    throw error;
  }
}
