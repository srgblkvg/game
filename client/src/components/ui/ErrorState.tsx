import type { ReactNode } from 'react';
import { selectErrorText } from './errorStateModel';

export interface ErrorStateProps {
  error?: string | null;
  children?: ReactNode;
}

export default function ErrorState({ error, children }: ErrorStateProps) {
  const errorText = selectErrorText(error);
  if (!errorText) return children ?? null;
  return <div className="p-4 text-[var(--color-accent-danger)]">{errorText}</div>;
}
