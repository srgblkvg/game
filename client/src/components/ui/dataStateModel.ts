export type DataStateKind = 'loading' | 'error' | 'empty' | 'data';

export interface DataStateInput {
  isLoading: boolean;
  error?: string | null;
  isEmpty: boolean;
}

export function selectDataState({ isLoading, error, isEmpty }: DataStateInput): DataStateKind {
  if (isLoading) return 'loading';
  if (error) return 'error';
  if (isEmpty) return 'empty';
  return 'data';
}
