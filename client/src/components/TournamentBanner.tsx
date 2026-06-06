import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';

interface TournamentInfo {
    id: number;
    division: string;
    status: string;
    registrationStart: number;
    registrationEnd: number;
    prizePool: number;
    participantCount: number;
    myRegistration: { userId: number; goldenTicket: number; snapshotStats?: { place: number; prize: number } } | null;
    participants?: { id: number; username: string; snapshotStats?: { place: number; prize: number } }[];
}

const DIVISION_LABELS: Record<string, string> = {
    copper: 'Медный', steel: 'Стальной', mithril: 'Мифриловый', adamant: 'Адамантовый',
};

const DIVISION_ICONS: Record<string, string> = {
    copper: '🥉', steel: '🥈', mithril: '🥇', adamant: '👑',
};

const DIVISION_LEVELS: Record<string, [number, number]> = {
    copper: [1, 15], steel: [16, 35], mithril: [36, 60], adamant: [61, 999],
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

function isPlayerDivision(division: string, userLevel: number): boolean {
    const [min, max] = DIVISION_LEVELS[division] || [0, 0];
    return userLevel >= min && userLevel <= max;
}

export default function TournamentBanner() {
    const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
    const [userLevel, setUserLevel] = useState(1);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { user } = useAuth();
    const isGuest = user?.isGuest || false;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token || isGuest) { setLoading(false); return; }

        fetch('/api/tournament', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any) => {
                setTournaments(data.tournaments || []);
                setUserLevel(data.userLevel || 1);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return null;

    if (isGuest) {
        return (
            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl p-3 min-w-[210px] overflow-hidden opacity-60">
                <h3 className="text-[var(--color-text-accent)] text-base font-bold mb-2 flex items-center gap-1">
                    <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">🔒 Недоступны на гостевом аккаунте</p>
            </div>
        );
    }

    // Фильтруем: только активные (registration / in_progress)
    const now = Math.floor(Date.now() / 1000);
    const active = tournaments
        .filter(t => t.status === 'registration' || t.status === 'in_progress')
        .sort((a, b) => a.registrationEnd - b.registrationEnd);

    // Завершённые, где игрок участвовал
    const myCompleted = tournaments.filter(
        t => t.status === 'completed' && t.myRegistration
    );

    if (active.length === 0 && myCompleted.length === 0) {
        return (
            <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl p-3 min-w-[210px] overflow-hidden">
                <h3 className="text-[var(--color-text-accent)] text-base font-bold mb-2 flex items-center gap-1">
                    <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">Нет активных турниров</p>
            </div>
        );
    }

    return (
        <div className="bg-[var(--color-bg-secondary)] border-2 border-[var(--color-border-default)] rounded-xl p-3 min-w-[210px] overflow-hidden">
            <h3
                className="text-[var(--color-text-accent)] text-base font-bold mb-2 cursor-pointer flex items-center gap-1"
                onClick={() => navigate('/tournament')}
            >
                <Icon icon="game-icons:trophy" width="18" height="18" /> Турниры
            </h3>

            <div className="space-y-2">
                {active.map(t => {
                    const isMine = isPlayerDivision(t.division, userLevel);
                    const untilEnd = t.registrationEnd - now;
                    const untilStart = t.registrationStart - now;

                    return (
                        <div
                            key={t.id}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => navigate('/tournament')}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs">{DIVISION_ICONS[t.division]}</span>
                                <span className={`text-xs font-medium ${isMine ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                    {DIVISION_LABELS[t.division]}
                                    {isMine && ' ← ваш'}
                                </span>
                                <span className="text-[0.6rem] text-[var(--color-text-muted)] ml-auto">
                                    {t.status === 'registration'
                                        ? `⌛ ${formatTimer(Math.max(0, untilEnd))}`
                                        : '⚔️ идёт'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                                <span>{t.participantCount}/8 уч.</span>
                                <span>{t.prizePool} 🥇</span>
                                {t.myRegistration && (
                                    <span className="text-[var(--color-accent-success)]">✓</span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {myCompleted.length > 0 && (
                    <div className="border-t border-[var(--color-border-light)] pt-2 mt-2">
                        {myCompleted.slice(0, 2).map(t => {
                            const myPlace = t.myRegistration?.snapshotStats?.place;
                            return (
                                <div
                                    key={t.id}
                                    className="cursor-pointer hover:opacity-80 transition-opacity text-[0.6rem]"
                                    onClick={() => navigate('/tournament')}
                                >
                                    <span className="text-[var(--color-text-muted)]">
                                        {DIVISION_ICONS[t.division]} {DIVISION_LABELS[t.division]} — завершён
                                    </span>
                                    {myPlace && (
                                        <span className="text-[var(--color-accent-success)] ml-1">
                                            {myPlace}-е место
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
