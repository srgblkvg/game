import type { ReactNode } from 'react';
import { selectDataState } from './dataStateModel';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';

export interface DataStateProps {
  isLoading: boolean;
  error?: string | null;
  isEmpty: boolean;
  loading?: ReactNode;
  errorState?: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}

export default function DataState({
  isLoading,
  error,
  isEmpty,
  loading = <LoadingState />,
  errorState = <ErrorState error={error} />,
  empty = <EmptyState />,
  children,
}: DataStateProps) {
  const state = selectDataState({ isLoading, error, isEmpty });
  if (state === 'loading') return loading;
  if (state === 'error') return errorState;
  if (state === 'empty') return empty;
  return children;
}
