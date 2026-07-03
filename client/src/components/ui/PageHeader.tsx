import { Icon } from '@iconify/react';

interface PageHeaderProps {
    title: string;
    icon?: string;
    bgImage?: string | null;
}

export default function PageHeader({ title, icon, bgImage }: PageHeaderProps) {
    const bgStyle = bgImage ? { backgroundImage: `url(${bgImage})` } : {};

    return (
        <div className="relative bg-[var(--color-bg-secondary)] rounded-xl mb-4 p-4 h-28 overflow-hidden border border-[var(--color-border-default)]">
            {bgImage && (
                <div className="absolute inset-0 bg-cover bg-center opacity-25" style={bgStyle} />
            )}
            <div className="relative z-10 flex items-end h-full">
                <div className="flex items-center gap-2">
                    {icon && <Icon icon={icon} width="24" height="24" className="text-white" />}
                    <h1 className="text-lg font-bold text-white">{title}</h1>
                </div>
            </div>
        </div>
    );
}
