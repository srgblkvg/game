export type DataState<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'ready'; data: T };

export function selectDataState<T>(
  isLoading: boolean,
  data: T,
  isEmpty: (value: T) => boolean = defaultIsEmpty,
): DataState<T> {
  if (isLoading) return { status: 'loading' };
  return isEmpty(data) ? { status: 'empty' } : { status: 'ready', data };
}

function defaultIsEmpty(value: unknown): boolean {
  return Array.isArray(value) ? value.length === 0 : value == null;
}
