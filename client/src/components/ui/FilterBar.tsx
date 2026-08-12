import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export default function FilterBar({ children, className = '' }: FilterBarProps) {
  return (
    <div className={`flex flex-wrap gap-2 items-center mb-4 ${className}`}>
      {children}
    </div>
  );
}
