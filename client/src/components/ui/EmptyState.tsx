interface EmptyStateProps {
  message?: string;
}

export default function EmptyState({ message = 'Ничего нет' }: EmptyStateProps) {
  return (
    <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
      {message}
    </div>
  );
}
