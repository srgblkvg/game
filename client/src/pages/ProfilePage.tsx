import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CharacterCard from '../components/CharacterCard';
import { fetchPublicProfile } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import { formatMoney } from '../utils/money';

export default function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const { user } = useAuth();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        fetchPublicProfile(Number(userId))
            .then(data => setProfile(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) return <div className="p-4 text-[var(--color-text-primary)]">Загрузка...</div>;
    if (!profile) return <div className="p-4 text-[var(--color-text-primary)]">Игрок не найден</div>;

    const handleWriteMessage = () => {
        window.dispatchEvent(new CustomEvent('openPrivateChat', {
            detail: { id: Number(userId), name: profile.username, shouldOpenPanel: true },
        }));
    };

    const StatItem = ({ icon, label, value }: { icon: string; label: string; value: number | string }) => (
        <p className="text-sm flex items-center gap-1.5">
            <Icon icon={icon} width="14" height="14" className="text-[var(--color-text-muted)] shrink-0" />
            <span className="text-[var(--color-text-muted)]">{label}:</span>
            <span className="text-[var(--color-text-primary)] font-medium ml-auto">{value}</span>
        </p>
    );

    return (
        <div className="max-w-2xl mx-auto px-4 py-4">
            <BackButton />
            <h2 className="text-xl font-bold mb-4">Профиль игрока</h2>

            <div className="flex flex-wrap justify-center gap-8 mt-4">
                <CharacterCard
                    char={{
                        username: profile.username,
                        level: profile.level,
                        equipment: profile.equipment,
                        stats: profile.stats,
                        gender: profile.gender || 'male',
                    }}
                    side="left"
                    showHealth={false}
                    showExp={false}
                    readOnly
                />

                <div className="flex flex-col gap-2 min-w-[280px]">
                    {/* PvP */}
                    <h3 className="text-xs font-bold text-[var(--color-text-accent)] uppercase tracking-wider mt-2">
                        ⚔️ PvP (Арена)
                    </h3>
                    <StatItem icon="game-icons:crossed-swords" label="Боёв" value={profile.totalBattles || 0} />
                    <StatItem icon="game-icons:trophy" label="Побед" value={profile.wins || 0} />
                    <StatItem icon="game-icons:cash" label="Выбито" value={formatMoney(profile.totalPvpMoneyWon || 0)} />
                    <StatItem icon="game-icons:pay-money" label="Потеряно" value={formatMoney(profile.totalPvpMoneyLost || 0)} />

                    {/* PvE */}
                    <h3 className="text-xs font-bold text-[var(--color-accent-success)] uppercase tracking-wider mt-3">
                        💀 Охота (PvE)
                    </h3>
                    <StatItem icon="game-icons:crossed-swords" label="Боёв" value={profile.pveTotalBattles || 0} />
                    <StatItem icon="game-icons:trophy" label="Побед" value={profile.pveWins || 0} />
                    <StatItem icon="game-icons:cash" label="Выбито" value={formatMoney(profile.totalPveMoneyWon || 0)} />
                    <StatItem icon="game-icons:pay-money" label="Потеряно" value={formatMoney(profile.totalPveMoneyLost || 0)} />

                    {/* Турниры */}
                    <h3 className="text-xs font-bold text-[var(--color-accent-info)] uppercase tracking-wider mt-3">
                        🏆 Турниры
                    </h3>
                    <StatItem icon="game-icons:swords-emblem" label="Участий" value={profile.tournamentCount || 0} />
                    <StatItem icon="game-icons:laurel-crown" label="Призовых мест" value={profile.tournamentWins || 0} />

                    {/* Работы */}
                    <h3 className="text-xs font-bold text-[var(--color-accent-purple)] uppercase tracking-wider mt-3">
                        🔨 Работы
                    </h3>
                    <StatItem icon="game-icons:cash" label="Заработано" value={formatMoney(profile.totalJobMoney || 0)} />
                </div>
            </div>

            {user && user.id !== Number(userId) && (
                <div className="flex justify-center mt-6">
                    <Button variant="danger" size="md" onClick={(e) => { e.stopPropagation(); handleWriteMessage(); }}>
                        Написать сообщение
                    </Button>
                </div>
            )}
        </div>
    );
}
