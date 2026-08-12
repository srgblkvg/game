interface BadgeProps {
  color?: string;
  text: string;
  className?: string;
}

export default function Badge({ color = '#888', text, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-block text-xs font-bold px-1.5 py-0.5 rounded text-white bg-[var(--badge-bg)] ${className}`}
      style={{ '--badge-bg': color } as React.CSSProperties}
    >
      {text}
    </span>
  );
}
