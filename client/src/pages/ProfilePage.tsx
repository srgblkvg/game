import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import CharacterCard from '../components/CharacterCard';
import { fetchPublicProfile } from '../api/character';

export default function ProfilePage() {
    const { userId } = useParams<{ userId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        fetchPublicProfile(Number(userId))
            .then(data => {
                setProfile(data);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [userId]);

    if (loading) return <div>Загрузка...</div>;
    if (!profile) return <div>Игрок не найден</div>;

    const handleWriteMessage = () => {
        window.dispatchEvent(new CustomEvent('openPrivateChat', {
            detail: {
                id: Number(userId),
                name: profile.username,
                shouldOpenPanel: true,
            },
        }));
    };

    return (
        <div style={{ padding: '1rem', color: '#eee', maxWidth: '700px', margin: '0 auto' }}>
            <button onClick={() => navigate(-1)} style={{ background: '#555', border: 'none', color: '#fff', padding: '0.4rem 1rem', borderRadius: '6px', cursor: 'pointer', marginBottom: '1rem' }}>← Назад</button>
            <h2>Профиль игрока</h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                <CharacterCard
                    char={{
                        username: profile.username,
                        level: profile.level,
                        equipment: profile.equipment,
                        stats: profile.stats,
                        gender: profile.gender || 'male', // гарантированно передаём
                    }}
                    side="left"
                    showHealth={false}
                    showStamina={false}
                    showExp={false}
                    readOnly
                />

                <div style={{
                    minWidth: '180px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '0.5rem',
                }}>
                    <p style={{ fontSize: '1.1rem', margin: 0 }}>⚔️ Боёв: {profile.totalBattles}</p>
                    <p style={{ fontSize: '1.1rem', margin: 0 }}>🏆 Побед: {profile.wins}</p>
                </div>
            </div>

            {user && user.id !== Number(userId) && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation(); // предотвращает сворачивание чата
                            handleWriteMessage();
                        }}
                        style={{ padding: '0.5rem 1.5rem', background: '#e63946', border: 'none', borderRadius: '6px', color: '#fff', cursor: 'pointer' }}
                    >
                        Написать сообщение
                    </button>
                </div>
            )}
        </div>
    );
}