import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
type Size = 'xs' | 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:   'bg-[var(--color-accent-info)] hover:brightness-75 text-white',
  secondary: 'bg-[var(--color-border-light)] hover:bg-[var(--color-border-default)] text-white',
  danger:    'bg-[var(--color-accent-danger)] hover:brightness-75 text-white',
  ghost:     'bg-transparent hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]',
  success:   'bg-[var(--color-accent-success)] hover:brightness-75 text-white',
};

const sizeClasses: Record<Size, string> = {
  xs: 'text-xs px-1.5 py-0.5 rounded-sm',
  sm: 'text-xs px-2 py-1 rounded',
  md: 'text-sm px-3 py-1.5 rounded-md',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  fullWidth,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-1 font-medium',
        'cursor-pointer transition-all duration-150',
        'disabled:opacity-50 disabled:brightness-75 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      ].filter(Boolean).join(' ')}
      disabled={disabled}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
