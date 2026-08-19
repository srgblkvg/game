import type { ReactNode } from 'react';
import { selectLoadingText } from './loadingState';

export interface LoadingStateProps {
  isLoading?: boolean;
  children?: ReactNode;
  text?: string;
}

export default function LoadingState({ isLoading = true, children, text = 'Загрузка...' }: LoadingStateProps) {
  if (!isLoading) return children ?? null;
  const loadingText = selectLoadingText(isLoading, text);

  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-[var(--color-text-muted)] text-sm">{loadingText}</div>
    </div>
  );
}
