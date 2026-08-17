import { useEffect } from 'react';
import { Icon } from '@iconify/react';
import { useTheme } from '../../contexts/ThemeContext';

interface PageHeaderProps {
    title: string;
    icon?: string;
    bgImage?: string | null;
}

export default function PageHeader({ title, icon, bgImage }: PageHeaderProps) {
    const { theme } = useTheme();

    // Сброс скролла при переходе на страницу
    useEffect(() => {
        // Снимаем возможный scroll-lock
        document.body.style.position = '';
        document.body.style.overflow = '';
        document.body.style.top = '';
        document.body.style.width = '';
        // Сбрасываем скролл — с задержкой чтобы DOM перестроился
        requestAnimationFrame(() => {
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            window.scrollTo(0, 0);
        });
    }, []);

    return (
        <div className="relative bg-[var(--color-bg-secondary)] rounded-xl mb-4 p-4 h-28 overflow-hidden border border-[var(--color-border-default)]">
            {bgImage && (
                <>
                    <img src={bgImage} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
                    <div
                        className="absolute inset-0"
                        style={{ backgroundColor: theme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(245,240,232,0.30)' }}
                    />
                </>
            )}
            <div className="relative z-10 flex items-end h-full">
                <div className="flex items-center gap-2">
                    {icon && <Icon icon={icon} width="24" height="24" className="text-[var(--color-text-primary)]" />}
                    <h1 className="text-lg font-bold text-[var(--color-text-primary)]" style={theme === 'light' ? { textShadow: '0 1px 1px rgba(255,255,255,0.9)' } : undefined}>{title}</h1>
                </div>
            </div>
        </div>
    );
}
