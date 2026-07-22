import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { formatMoney } from '../utils/money';

interface TournamentInfo {
    id: number;
    division: string;
    type: string;
    status: string;
    registrationStart: number;
    registrationEnd: number;
    prizePool: number;
    participantCount: number;
    entryFee?: number;
    name?: string;
    minLevel?: number;
    maxLevel?: number;
    maxPlayers?: number;
    myRegistration: { userId: number; goldenTicket: number; snapshotStats?: { place: number; prize: number } } | null;
    participants?: { id: number; username: string; snapshotStats?: { place: number; prize: number } }[];
}

const DIVISION_LABELS: Record<string, string> = {
    copper: 'Медный', bronze: 'Бронзовый', iron: 'Железный', steel: 'Стальной', silver: 'Серебряный',
    gold: 'Золотой', platinum: 'Платиновый', mithril: 'Мифриловый', adamant: 'Адамантиновый', orichalcum: 'Орихалковый',
};

const DIVISION_ICONS: Record<string, string> = {
    copper: '🥉', bronze: '🥉', iron: '🥈', steel: '🥈', silver: '🥈',
    gold: '🥇', platinum: '🥇', mithril: '🥇', adamant: '👑', orichalcum: '💎',
};

const DIVISION_LEVELS: Record<string, [number, number]> = {
    copper: [1, 5], bronze: [3, 7], iron: [5, 9], steel: [7, 11], silver: [9, 13],
    gold: [11, 15], platinum: [13, 17], mithril: [15, 19], adamant: [17, 21], orichalcum: [19, 999],
};

function formatTimer(seconds: number): string {
    if (seconds <= 0) return '0 мин';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts: string[] = [];
    if (d > 0) parts.push(d + ' дн');
    if (h > 0) parts.push(h + ' ч');
    if (m > 0) parts.push(m + ' мин');
    return parts.join(' ') || '0 мин';
}

function canJoin(t: TournamentInfo, userLevel: number): boolean {
    if (t.type === 'official') {
        const [min, max] = DIVISION_LEVELS[t.division] || [0, 0];
        return userLevel >= min && userLevel <= max;
    }
    return userLevel >= (t.minLevel || 1) && userLevel <= (t.maxLevel || 999);
}

function tournamentLabel(t: TournamentInfo): string {
    if (t.type === 'custom') return t.name || 'Турнир';
    return DIVISION_LABELS[t.division] || t.division;
}

function tournamentIcon(t: TournamentInfo): string {
    if (t.type === 'custom') return '🎪';
    return DIVISION_ICONS[t.division] || '🏆';
}

export default function TournamentBanner() {
    const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
    const [userLevel, setUserLevel] = useState(1);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }

        const load = () => {
            fetch('/api/tournament', { headers: getHeaders() })
                .then(r => r.json())
                .then((data: any) => {
                    setTournaments(data.tournaments || []);
                    setUserLevel(data.userLevel || 1);
                })
                .catch(() => {})
                .finally(() => setLoading(false));
        };

        load();
        const interval = setInterval(load, 10000);
        const onTournamentCreated = () => load();
        window.addEventListener('tournamentUpdated', onTournamentCreated);
        return () => {
            clearInterval(interval);
            window.removeEventListener('tournamentUpdated', onTournamentCreated);
        };
    }, []);

    if (loading) return (
        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
            <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-text-accent)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigate('/tournament'); }}>
                <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">Загрузка...</p>
        </div>
    );

    const now = Math.floor(Date.now() / 1000);

    // Только турниры, где игрок может участвовать
    const active = tournaments
        .filter(t => (t.status === 'registration' || t.status === 'in_progress') && canJoin(t, userLevel))
        .sort((a, b) => a.registrationEnd - b.registrationEnd);

    const myCompleted = tournaments.filter(t => t.status === 'completed' && t.myRegistration);

    if (active.length === 0 && myCompleted.length === 0) {
        return (
            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
                <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-text-accent)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigate('/tournament'); }}>
                    <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">Нет активных турниров</p>
            </div>
        );
    }

    return (
        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl pt-5 pb-4 px-4 min-w-[210px] relative">
            <h3 className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-full text-[var(--color-text-accent)] text-base font-bold cursor-pointer hover:text-[var(--color-accent-info)] flex items-center gap-1 whitespace-nowrap" onClick={(e) => { e.stopPropagation(); navigate('/tournament'); }}>
                <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
            </h3>

            <div className="space-y-2">
                {active.slice(0, 3).map(t => {
                    const joinable = canJoin(t, userLevel);
                    const untilEnd = t.registrationEnd - now;

                    return (
                        <div key={t.id} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/tournament')}>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs">{tournamentIcon(t)}</span>
                                <span className={`text-xs font-medium ${joinable ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                    {tournamentLabel(t)}
                                    {t.type === 'custom' && <span className="text-xs ml-0.5 text-[var(--color-accent-purple)]">игр.</span>}
                                </span>
                                <span className="text-xs text-[var(--color-text-muted)] ml-auto">
                                    {t.status === 'registration' ? `⌛ ${formatTimer(Math.max(0, untilEnd))}` : '⚔️ идёт'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mt-0.5">
                                <span>{t.participantCount}/{t.maxPlayers || 8} уч.</span>
                                <span>Призовой фонд: {formatMoney(t.prizePool)}</span>
                                {t.entryFee ? <span>вход {t.entryFee}</span> : null}
                                {t.myRegistration && <span className="text-[var(--color-accent-success)]">✓</span>}
                            </div>
                        </div>
                    );
                })}

                {myCompleted.length > 0 && (
                    <div className="border-t border-[var(--color-border-light)] pt-2 mt-2">
                        {myCompleted.slice(0, 2).map(t => {
                            const myPlace = t.myRegistration?.snapshotStats?.place;
                            return (
                                <div key={t.id} className="cursor-pointer hover:opacity-80 transition-opacity text-xs" onClick={() => navigate('/tournament')}>
                                    <span className="text-[var(--color-text-muted)]">{tournamentIcon(t)} {tournamentLabel(t)} — завершён</span>
                                    {myPlace && <span className="text-[var(--color-accent-success)] ml-1">{myPlace}-е место</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
