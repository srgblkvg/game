import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';
import { fmtSafeDate } from '../utils/date';

const links = [
    { path: '/tournament', icon: 'game-icons:trophy-cup', title: 'Турниры', desc: 'Участвуйте в турнирах и выигрывайте призы' },
    { path: '/rating', icon: 'game-icons:rank-3', title: 'Рейтинг игроков', desc: 'Таблица лидеров PvP-арены' },
    { path: '/guild/rating', icon: 'game-icons:castle', title: 'Рейтинг гильдий', desc: 'Лучшие гильдии королевства' },
];

export default function CastlePage() {
    const navigate = useNavigate();
    const [treasury, setTreasury] = useState<number | null>(null);
    const [latestThreads, setLatestThreads] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/treasury').then(r => r.json()).then(d => setTreasury(d.amount)).catch(() => {});
        fetch('/api/forum/latest').then(r => r.json()).then(d => setLatestThreads(Array.isArray(d) ? d : [])).catch(() => {});
    }, []);

    return (
        <div className="px-4 py-4 max-w-md mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-4">
                <Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Замок
            </h1>

            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-4">
                Турниры, рейтинги и состязания королевства.
            </p>

            {treasury !== null && (
                <div className="mb-4 p-3 bg-[var(--color-bg-card)] border border-[var(--color-accent-warning)] rounded-lg text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">Казна замка</p>
                    <p className="text-lg font-bold text-[var(--color-accent-warning)]">{formatMoney(treasury)}</p>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-1">
                        Сборы с банка, магазина, аукциона и ремесла
                    </p>
                </div>
            )}

            <div className="space-y-3 mb-4">
                {links.map(link => (
                    <Card
                        key={link.path}
                        className="flex items-center gap-4 p-4 cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                        onClick={() => navigate(link.path)}
                    >
                        <Icon icon={link.icon} width="28" height="28" className="text-[var(--color-accent-info)] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm">{link.title}</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">{link.desc}</p>
                        </div>
                        <Icon icon="game-icons:arrow-right" width="16" height="16" className="text-[var(--color-text-muted)] shrink-0" />
                    </Card>
                ))}
            </div>

            {/* Форум */}
            <div className="mb-4">
                <h2 className="text-sm font-bold mb-2 flex items-center gap-1 cursor-pointer hover:text-[var(--color-accent-info)]"
                    onClick={() => navigate('/forum')}>
                    <Icon icon="game-icons:discussion" width="16" height="16" />Форум
                </h2>
                {latestThreads.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Тем пока нет</p>
                ) : (
                    <div className="space-y-2">
                        {latestThreads.map((t: any) => (
                            <Card key={t.id} className="p-3 cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                                onClick={() => navigate(`/forum/${t.id}`)}>
                                <h3 className="text-sm font-bold truncate">{t.title}</h3>
                                <div className="flex justify-between text-[0.65rem] text-[var(--color-text-muted)] mt-1">
                                    <span>{t.author_name} • {fmtSafeDate(t.created_at, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                                    {t.last_poster_name && (
                                        <span>{t.last_poster_name} • {fmtSafeDate(t.updated_at, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
