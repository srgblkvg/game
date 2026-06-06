import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders } from '../api/helpers';

interface TournamentInfo {
    id: number;
    division: string;
    status: string;
    registrationStart: number;
    registrationEnd: number;
    prizePool: number;
    participantCount: number;
    myRegistration: { userId: number; goldenTicket: number } | null;
}

interface DivisionInfo {
    name: string;
    label: string;
}

const DIVISIONS: Record<string, DivisionInfo> = {
    copper: { name: 'copper', label: 'Медный' },
    steel: { name: 'steel', label: 'Стальной' },
    mithril: { name: 'mithril', label: 'Мифриловый' },
    adamant: { name: 'adamant', label: 'Адамантовый' },
};

const DIVISION_ICONS: Record<string, string> = {
    copper: 'game-icons:bronze-medal',
    steel: 'game-icons:silver-medal',
    mithril: 'game-icons:gold-medal',
    adamant: 'game-icons:diamond-trophy',
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

export default function TournamentBanner() {
    const [info, setInfo] = useState<{ tournament: TournamentInfo; userLevel: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { setLoading(false); return; }

        fetch('/api/tournament', { headers: getHeaders() })
            .then(r => r.json())
            .then((data: any) => {
                const tournaments: TournamentInfo[] = data.tournaments || [];
                const userLevel: number = data.userLevel || 1;

                // Найти турнир по уровню
                const found = tournaments.find((t: TournamentInfo) => {
                    if (t.division === 'copper' && userLevel <= 15) return true;
                    if (t.division === 'steel' && userLevel >= 16 && userLevel <= 35) return true;
                    if (t.division === 'mithril' && userLevel >= 36 && userLevel <= 60) return true;
                    if (t.division === 'adamant' && userLevel >= 61) return true;
                    return false;
                });

                if (found) {
                    setInfo({ tournament: found, userLevel });
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading || !info) return null;

    const { tournament, userLevel } = info;
    const div = DIVISIONS[tournament.division] || { name: tournament.division, label: tournament.division };
    const icon = DIVISION_ICONS[tournament.division] || 'game-icons:trophy';
    const now = Math.floor(Date.now() / 1000);

    // Этап 1: до начала регистрации
    if (now < tournament.registrationStart) {
        const until = tournament.registrationStart - now;
        return (
            <div className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-border-default)]">
                <div className="flex items-center gap-2 mb-1">
                    <Icon icon={icon} width="18" height="18" className="text-[var(--color-accent-info)]" />
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">
                        {div.label} турнир
                    </span>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                    Регистрация через {formatTimer(until)}
                </p>
            </div>
        );
    }

    // Этап 2: идёт регистрация
    if (now < tournament.registrationEnd) {
        const until = tournament.registrationEnd - now;
        return (
            <div
                className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-accent-info)] cursor-pointer hover:border-[var(--color-accent-purple)] transition-colors"
                onClick={() => navigate('/tournament')}
            >
                <div className="flex items-center gap-2 mb-1">
                    <Icon icon={icon} width="18" height="18" className="text-[var(--color-accent-info)]" />
                    <span className="text-sm font-bold text-[var(--color-text-primary)]">
                        {div.label} турнир
                    </span>
                </div>
                <p className="text-xs text-[var(--color-accent-success)] font-medium">
                    Доступна регистрация ({formatTimer(until)})
                </p>
                <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                    Участников: {tournament.participantCount} • Призовой фонд: {tournament.prizePool} серебра
                </p>
                {tournament.myRegistration && (
                    <p className="text-[0.6rem] text-[var(--color-accent-success)] mt-0.5">✓ Вы зарегистрированы</p>
                )}
            </div>
        );
    }

    // Этап 3: турнир идёт
    return (
        <div
            className="bg-[var(--color-bg-card)] rounded-xl p-3 border border-[var(--color-accent-danger)] cursor-pointer hover:border-[var(--color-accent-purple)] transition-colors"
            onClick={() => navigate('/tournament')}
        >
            <div className="flex items-center gap-2 mb-1">
                <Icon icon={icon} width="18" height="18" className="text-[var(--color-accent-danger)]" />
                <span className="text-sm font-bold text-[var(--color-text-primary)]">
                    {div.label} турнир
                </span>
            </div>
            <p className="text-xs text-[var(--color-accent-danger)] font-medium">
                Турнир в самом разгаре!
            </p>
            <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                Участников: {tournament.participantCount} • Призовой фонд: {tournament.prizePool} серебра
            </p>
        </div>
    );
}
