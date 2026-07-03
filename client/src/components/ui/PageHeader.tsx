import { Icon } from '@iconify/react';

interface PageHeaderProps {
    title: string;
    icon?: string;
    bgImage?: string | null;
}

export default function PageHeader({ title, icon, bgImage }: PageHeaderProps) {
    const bgStyle = bgImage ? { backgroundImage: `url(${bgImage})` } : {};

    return (
        <div className="relative bg-[var(--color-bg-secondary)] rounded-xl mb-4 p-4 h-28 flex flex-col items-center justify-center text-center overflow-hidden border border-[var(--color-border-default)]">
            {bgImage && (
                <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
            )}
            <div className="relative z-10">
                {icon && <Icon icon={icon} width="28" height="28" className="text-white mb-1" />}
                <h1 className="text-lg font-bold text-white">{title}</h1>
            </div>
        </div>
    );
}
