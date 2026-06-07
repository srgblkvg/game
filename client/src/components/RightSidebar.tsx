import { useState } from 'react';
import { Icon } from '@iconify/react';
import TournamentBanner from './TournamentBanner';
import RatingBlock from './RatingBlock';
import QuestsBlock from './QuestsBlock';

export default function RightSidebar() {
    const [open, setOpen] = useState(false);

    const handleHighlight = (type: string | null) => {
        if (type) { window.location.hash = `action-${type}`; }
        else { window.location.hash = ''; }
    };

    return (
        <>
            <button
                onClick={() => setOpen(!open)}
                className="fixed right-3 top-16 z-50 w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] shadow-lg"
                title={open ? 'Скрыть панель' : 'Показать панель'}
            >
                <Icon icon={open ? 'mdi:close' : 'mdi:menu'} width="16" height="16" />
            </button>

            {/* Оверлей */}
            <div
                className={`fixed inset-0 z-25 bg-black/20 transition-opacity duration-400 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setOpen(false)}
            />

            {/* Панель */}
            <div
                className={`fixed right-0 top-0 z-20 h-full w-[240px] bg-[var(--color-bg-primary)]/60 backdrop-blur-xl border-l border-[var(--color-border-default)] overflow-y-auto p-3 pt-24 pb-16 shadow-2xl transition-transform duration-400 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
            >
                <div className="flex flex-col gap-4">
                    <QuestsBlock onHighlight={handleHighlight} />
                    <TournamentBanner />
                    <RatingBlock />
                </div>
            </div>
        </>
    );
}
