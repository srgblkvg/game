import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { getHeaders, BASE_URL } from '../api/helpers';
import { useAuth } from '../contexts/AuthContext';
import Card from '../components/ui/Card';

export default function GuildRatingPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [guilds, setGuilds] = useState<any[]>([]);

    useEffect(() => { if (!user) navigate('/login');
        fetch(`${BASE_URL}/guild/list`, { headers: getHeaders() })
            .then(r => r.json()).then(setGuilds).catch(() => {});
    }, [user]);

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Рейтинг гильдий</h1>
            {guilds.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет гильдий</p>
            ) : (
                guilds.map((g: any) => (
                    <Card key={g.id} className="mb-2">
                        <div className="flex justify-between items-center">
                            <div className="cursor-pointer" onClick={() => navigate(`/guild/${g.id}`)}>
                                <h4 className="font-bold text-sm hover:text-[var(--color-accent-info)] transition-colors">🏚️ {g.name}</h4>
                                <p className="text-xs text-[var(--color-text-muted)]">
                                    Ур.{g.level} • {g.memberCount} уч. • 👑 {g.leaderName}
                                </p>
                            </div>
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
}
