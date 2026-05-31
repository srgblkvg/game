import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h2>
      {children}
    </div>
  );
}
