import { Icon } from '@iconify/react';

interface PageHeaderProps {
    title: string;
    icon?: string;
    bgImage?: string | null;
    subtitle?: string;
}

export default function PageHeader({ title, icon, bgImage, subtitle }: PageHeaderProps) {
    return (
        <div className="relative w-full h-32 sm:h-40 mb-4 rounded-xl overflow-hidden">
            {bgImage && (
                <img
                    src={bgImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg-primary)] via-[var(--color-bg-primary)]/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-2">
                {icon && <Icon icon={icon} width="24" height="24" className="text-[var(--color-accent-warning)]" />}
                <div>
                    <h1 className="text-xl font-bold text-[var(--color-text-primary)]">{title}</h1>
                    {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
                </div>
            </div>
        </div>
    );
}
