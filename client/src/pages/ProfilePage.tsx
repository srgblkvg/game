import { Icon } from "@iconify/react";
import BackButton from '../components/BackButton';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CharacterCard from '../components/CharacterCard';
import { fetchPublicProfile } from '../api/character';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { fmtSafeDate } from '../utils/date';
import { formatMoney } from '../utils/money';
import { getHeaders } from '../api/helpers';

const StatItem = ({ icon, label, value }: { icon: string; label: string; value: number | string }) => (
    <p className="text-xs flex items-center gap-1.5">
        <Icon icon={icon} width="12" height="12" className="text-[var(--color-text-muted)] shrink-0" />
        <span className="text-[var(--color-text-muted)]">{label}:</span>
        <span className="text-[var(--color-text-primary)] font-medium ml-auto">{value}</span>
    </p>
);

interface StatSectionProps {
    title: string;
    icon: string;
    color: string;
    children: React.ReactNode;
    className?: string;
}

const StatSection = ({ title, icon, color, children, className }: StatSectionProps) => (
    <Card className={className}>
        <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color }}>
            {icon} {title}
        </h3>
        <div className="space-y-1">{children}</div>
    </Card>
);

export default function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [achScore, setAchScore] = useState(0);

    useEffect(() => {
        if (!userId) return;
        fetchPublicProfile(Number(userId))
            .then(data => setProfile(data))
            .catch(console.error)
            .finally(() => setLoading(false));
        fetch(`/api/achievements/${userId}`, { headers: getHeaders() })
            .then(r => r.json())
            .then(data => {
                if (data && data.score !== undefined) {
                    setAchScore(data.score || 0);
                }
            })
            .catch(() => {});
    }, [userId]);

    if (loading) return <div className="p-4 text-[var(--color-text-primary)]">Загрузка...</div>;
    if (!profile) return <div className="p-4 text-[var(--color-text-primary)]">Игрок не найден</div>;

    const handleWriteMessage = () => {
        window.dispatchEvent(new CustomEvent('openPrivateChat', {
            detail: { id: Number(userId), name: profile.username, shouldOpenPanel: true },
        }));
    };

    const jobTime = (() => {
        const s = profile.totalJobSeconds || 0;
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h} ч ${m} мин` : `${m} мин`;
    })();

    return (
        <div className="max-w-4xl mx-auto px-4 py-4">
            <BackButton />
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Профиль игрока</h2>
                <Button variant="secondary" size="md" onClick={() => navigate('/rating')}>
                    Рейтинг игроков
                </Button>
            </div>

            <div className="flex flex-col items-center gap-6 mt-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 w-full justify-center">
                    <CharacterCard
                        char={{
                            username: profile.username,
                            level: profile.level,
                            equipment: profile.equipment,
                            stats: profile.stats,
                            gender: profile.gender || 'male',
                            guildName: profile.guildName,
                            guildId: profile.guildId,
                            avatar: profile.avatar || null,
                        }}
                        side="left"
                        showHealth={false}
                        showExp={false}
                        readOnly
                    />

                    <div className="flex flex-col items-center sm:items-start justify-center gap-3 min-w-[160px]">
                        {achScore > 0 && (
                            <div className="text-sm font-bold text-[var(--color-accent-gold)]">
                                🏆 Достижения — {achScore} очк.
                            </div>
                        )}
                        {profile.createdAt && (
                            <div className="text-xs text-[var(--color-text-muted)]">
                                Дата регистрации: {fmtSafeDate(profile.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                            </div>
                        )}
                        {user && user.id !== Number(userId) && (
                            <Button variant="danger" size="md" onClick={(e) => { e.stopPropagation(); handleWriteMessage(); }}>
                                Написать сообщение
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                    <StatSection title="PvP (Арена)" icon="⚔️" color="var(--color-text-accent)">
                        <StatItem icon="game-icons:crossed-swords" label="Боёв" value={profile.totalBattles || 0} />
                        <StatItem icon="game-icons:trophy" label="Побед" value={profile.wins || 0} />
                        <StatItem icon="game-icons:cash" label="Выбито" value={formatMoney(profile.totalPvpMoneyWon || 0)} />
                        <StatItem icon="game-icons:pay-money" label="Потеряно" value={formatMoney(profile.totalPvpMoneyLost || 0)} />
                    </StatSection>

                    <StatSection title="Охота (PvE)" icon="💀" color="var(--color-accent-success)">
                        <StatItem icon="game-icons:crossed-swords" label="Боёв" value={profile.pveTotalBattles || 0} />
                        <StatItem icon="game-icons:trophy" label="Побед" value={profile.pveWins || 0} />
                        <StatItem icon="game-icons:cash" label="Выбито" value={formatMoney(profile.totalPveMoneyWon || 0)} />
                        <StatItem icon="game-icons:pay-money" label="Потеряно" value={formatMoney(profile.totalPveMoneyLost || 0)} />
                    </StatSection>

                    <StatSection title="Резня" icon="⚔️" color="var(--color-accent-danger)">
                        <StatItem icon="game-icons:crossed-swords" label="Участий" value={profile.massacreParticipations || 0} />
                        <StatItem icon="game-icons:trophy" label="Побед" value={profile.massacreWins || 0} />
                    </StatSection>

                    <StatSection title="Турниры" icon="🏆" color="var(--color-accent-info)">
                        <StatItem icon="game-icons:swords-emblem" label="Участий" value={profile.tournamentCount || 0} />
                        <StatItem icon="game-icons:laurel-crown" label="Призовых мест" value={profile.tournamentWins || 0} />
                    </StatSection>

                    <StatSection title="Работы" icon="🔨" color="var(--color-accent-purple)">
                        <StatItem icon="game-icons:cash" label="Заработано" value={formatMoney(profile.totalJobMoney || 0)} />
                        <StatItem icon="game-icons:hourglass" label="Времени" value={jobTime} />
                    </StatSection>

                    <StatSection title="Ремесло" icon="⚒️" color="var(--color-accent-warning)">
                        <StatItem icon="game-icons:anvil" label="Создано" value={profile.craftCreated || 0} />
                        <StatItem icon="game-icons:arrow-dunk" label="Улучшено" value={profile.craftUpgraded || 0} />
                        <StatItem icon="game-icons:broken-shield" label="Сломано" value={profile.craftBroken || 0} />
                    </StatSection>

                    <StatSection title="Аукцион" icon="📦" color="var(--color-accent-warning)">
                        <StatItem icon="game-icons:pay-money" label="Куплено" value={profile.auctionBought || 0} />
                        <StatItem icon="game-icons:cash" label="Продано" value={profile.auctionSold || 0} />
                    </StatSection>

                    <StatSection title="Игорный дом" icon="🎰" color="var(--color-accent-purple)">
                        <StatItem icon="game-icons:card-play" label="Игр" value={profile.casinoGamesPlayed || 0} />
                        <StatItem icon="game-icons:cash" label="Выиграно" value={formatMoney(profile.casinoWon || 0)} />
                        <StatItem icon="game-icons:pay-money" label="Проиграно" value={formatMoney(profile.casinoLost || 0)} />
                    </StatSection>
                </div>
            </div>
        </div>
    );
}
