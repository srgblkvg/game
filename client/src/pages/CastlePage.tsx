import PageHeader from '../components/ui/PageHeader';
import { getHeaders } from '../api/helpers';
import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import Button from '../components/ui/Button';
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
  const [actionCard, setActionCard] = useState<any>(null);
  useEffect(() => { fetch('/api/actions', { headers: getHeaders() }).then(r => r.json()).then((cards: any[]) => { const c = cards.find((x: any) => x.path === '/castle'); if (c) setActionCard(c); }).catch(() => {}); }, []);
    const navigate = useNavigate();
    const [treasury, setTreasury] = useState<number | null>(null);
    const [latestThreads, setLatestThreads] = useState<any[]>([]);
    const [activeWars, setActiveWars] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/treasury').then(r => r.json()).then(d => setTreasury(d.amount)).catch(() => {});
        fetch('/api/forum/latest').then(r => r.json()).then(d => setLatestThreads(Array.isArray(d) ? d : [])).catch(() => {});
        fetch('/api/guild/war/active', { headers: getHeaders() }).then(r => r.json()).then(d => setActiveWars(d.wars || [])).catch(() => {});
    }, []);

    return (
        <div className="px-4 py-4 max-w-md mx-auto">
            <BackButton />
          {actionCard && <PageHeader title="Замок" icon={actionCard.icon} bgImage={actionCard.bg_image} />}

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

            {/* Конфликты */}
            {activeWars.length > 0 && (
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                        <h2 className="text-sm font-bold flex items-center gap-1 cursor-pointer hover:text-[var(--color-accent-info)]"
                            onClick={() => navigate('/conflicts')}>
                            <Icon icon="game-icons:crossed-swords" width="16" height="16" />Конфликты ({activeWars.length})
                        </h2>
                        <Button variant="secondary" size="md" onClick={() => navigate('/conflicts')}>Все</Button>
                    </div>
                    <div className="space-y-2">
                        {activeWars.slice(0, 3).map((war: any) => {
                            const expiresIn = Math.max(0, new Date(war.expiresAt).getTime() - Date.now());
                            const hoursLeft = Math.floor(expiresIn / (1000 * 60 * 60));
                            return (
                                <Card key={war.id} className="p-2 cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                                    onClick={() => navigate('/conflicts')}>
                                    <div className="flex items-center gap-1 text-xs">
                                        <span className="font-bold truncate">{war.attackerGuild.name}</span>
                                        <span className="text-[var(--color-accent-danger)] text-[0.65rem]">VS</span>
                                        <span className="font-bold truncate">{war.defenderGuild.name}</span>
                                        <span className="ml-auto text-[0.65rem] font-bold">
                                            {war.attackerScore}:{war.defenderScore}
                                        </span>
                                    </div>
                                    <div className="text-[0.6rem] text-[var(--color-text-muted)] text-right">
                                        {expiresIn > 0 ? `${hoursLeft}ч` : '...'}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Форум */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-bold flex items-center gap-1 cursor-pointer hover:text-[var(--color-accent-info)]"
                        onClick={() => navigate('/forum')}>
                        <Icon icon="game-icons:discussion" width="16" height="16" />Форум
                    </h2>
                    <Button variant="secondary" size="md" onClick={() => navigate('/forum')}>Перейти</Button>
                </div>
                <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-2">Обсуждаемое:</p>
                {latestThreads.length === 0 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">Тем пока нет</p>
                ) : (
                    <div className="space-y-2">
                        {latestThreads.map((t: any) => (
                            <Card key={t.id} className="p-3 cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                                onClick={() => navigate(`/forum/${t.id}?page=last`)}>
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
