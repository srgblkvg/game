export type OperationEntryStatus = 'pending' | 'active' | 'success' | 'failure' | 'stopped';

export function getOperationEntryColor(status: OperationEntryStatus, active: boolean, showResult: boolean): string {
  if (active && !showResult) return '';
  if (status === 'success') return 'text-[var(--color-accent-success)]';
  if (status === 'failure') return 'text-[var(--color-accent-danger)]';
  if (status === 'stopped') return 'text-[var(--color-text-muted)]';
  return '';
}
