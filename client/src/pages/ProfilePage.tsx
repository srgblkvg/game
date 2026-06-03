import { Icon } from "@iconify/react";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CharacterCard from '../components/CharacterCard';
import { fetchPublicProfile } from '../api/character';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';

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

                <div className="flex flex-col justify-center items-center gap-2 min-w-[180px]">
                    <p className="text-base"><Icon icon="game-icons:crossed-swords" width="16" height="16" className="inline mr-1" />Боёв: {profile.totalBattles}</p>
                    <p className="text-base"><Icon icon="game-icons:trophy" width="16" height="16" className="inline mr-1" />Побед: {profile.wins}</p>
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
