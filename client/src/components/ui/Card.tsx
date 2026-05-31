import type { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  borderColor?: string;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

const paddingClasses = {
  sm: 'p-2',
  md: 'p-3',
  lg: 'p-4',
};

export default function Card({
  children,
  borderColor,
  padding = 'md',
  className = '',
  style,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'bg-[var(--color-bg-card)] rounded-xl',
        paddingClasses[padding],
        borderColor ? 'border-2' : 'border border-[var(--color-border-light)]',
        className,
      ].filter(Boolean).join(' ')}
      style={{
        ...(borderColor ? { borderColor } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
