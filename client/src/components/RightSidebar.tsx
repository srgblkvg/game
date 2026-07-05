import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import TournamentBanner from './TournamentBanner';
import RatingBlock from './RatingBlock';
import QuestsBlock from './QuestsBlock';

export default function RightSidebar() {
    const [open, setOpen] = useState(false);
    const location = useLocation();

    // Сворачивать панель при переходе на другую страницу
    useEffect(() => { setOpen(false); }, [location.pathname]);

    useEffect(() => {
        if (open) {
            // Сохраняем позицию скролла перед блокировкой
            const scrollY = window.scrollY;
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
        } else {
            const scrollY = parseInt(document.body.style.top || '0', 10);
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, Math.abs(scrollY));
        }
        return () => {
            const scrollY = parseInt(document.body.style.top || '0', 10);
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.top = '';
            document.body.style.width = '';
            window.scrollTo(0, Math.abs(scrollY));
        };
    }, [open]);

    const handleHighlight = (type: string | null) => {
        if (type) { window.location.hash = `action-${type}`; }
        else { window.location.hash = ''; }
    };

    return (
        <>
            <button
                data-tutorial="right-sidebar"
                onClick={() => { setOpen(!open); if (!open) window.dispatchEvent(new CustomEvent('closeChatPanel')); }}
                id="right-sidebar-toggle"
                className={`fixed right-3 top-[115px] z-[45] flex items-center gap-1.5 rounded-full border shadow-lg cursor-pointer transition-all duration-300 ${
                    open
                        ? 'w-8 h-8 bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] justify-center'
                        : 'px-3 py-1.5 bg-[var(--color-bg-secondary)] border-[var(--color-border-default)] hover:border-[var(--color-accent-warning)]'
                }`}
                title={open ? 'Скрыть панель' : 'Боевой журнал'}
            >
                <span className={`transition-transform duration-300 ${open ? 'rotate-90' : ''}`}>
                    <Icon icon={open ? 'game-icons:cross-mark' : 'game-icons:scroll-unfurled'} width="16" height="16" className="text-[var(--color-text-muted)]" />
                </span>
                {!open && <span className="text-xs font-bold text-[var(--color-text-primary)] whitespace-nowrap">Боевой журнал</span>}
            </button>

            {/* Оверлей */}
            <div
                className={`fixed inset-0 right-[340px] z-15 bg-black/20 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setOpen(false)}
            />

            {/* Панель */}
            <div
                id="right-sidebar-panel"
                className={`fixed right-0 top-[120px] z-20 w-[340px] h-[calc(100vh-120px-40px)] bg-[var(--color-bg-primary)]/60 backdrop-blur-xl border-l border-[var(--color-border-default)] shadow-2xl transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex flex-col gap-6 overflow-y-auto h-full p-3 pt-8 pb-10">
                    <QuestsBlock onHighlight={(type) => { handleHighlight(type); if (type) setOpen(false); }} />
                    <TournamentBanner />
                    <RatingBlock />
                </div>
            </div>
        </>
    );
}
