import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import BackButton from '../components/BackButton';
import Card from '../components/ui/Card';
import { getHeaders } from '../api/helpers';
import { useNavigate } from 'react-router-dom';
import { getWarTimeRemaining } from '../utils/warCountdown';

interface WarInfo {
    id: number;
    attackerGuild: { id: number; name: string };
    defenderGuild: { id: number; name: string };
    attackerScore: number;
    defenderScore: number;
    declaredAt: string;
    expiresAt: string;
}

export default function ConflictsPage() {
    const [wars, setWars] = useState<WarInfo[]>([]);
    const [loaded, setLoaded] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        fetch('/api/guild/war/active', { headers: getHeaders() })
            .then(r => r.json())
            .then(d => { setWars(d.wars || []); setLoaded(true); })
            .catch(() => setLoaded(true));
    }, []);

    return (
        <div className="max-w-3xl mx-auto px-4 py-4">
            <BackButton />
            <PageHeader title="Конфликты" icon="game-icons:crossed-swords" />
            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-3">
                Текущие войны между гильдиями. Следите за ходом битв!
            </p>

            {!loaded ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">Загрузка...</p>
            ) : wars.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                    Сейчас нет активных войн. Мирное время!
                </p>
            ) : (
                <div className="space-y-3">
                    {wars.map(war => {
                        const timeRemaining = getWarTimeRemaining(war.expiresAt, Date.now());

                        return (
                            <Card key={war.id} className="p-4">
                                {/* Гильдии и VS */}
                                <div className="flex items-center justify-center gap-4 mb-3">
                                    <span
                                        className="text-sm font-bold cursor-pointer hover:text-[var(--color-accent-info)] text-right flex-1 truncate"
                                        onClick={() => navigate(`/guild/${war.attackerGuild.id}`)}
                                    >{war.attackerGuild.name}</span>
                                    <span className="text-lg font-bold text-[var(--color-accent-danger)] flex-shrink-0">VS</span>
                                    <span
                                        className="text-sm font-bold cursor-pointer hover:text-[var(--color-accent-info)] text-left flex-1 truncate"
                                        onClick={() => navigate(`/guild/${war.defenderGuild.id}`)}
                                    >{war.defenderGuild.name}</span>
                                </div>
                                {/* Счёт по центру */}
                                <div className="flex items-center justify-center gap-3 mb-2">
                                    <span className={`text-xl font-bold ${war.attackerScore > war.defenderScore ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {war.attackerScore}
                                    </span>
                                    <span className="text-sm text-[var(--color-text-muted)]">—</span>
                                    <span className={`text-xl font-bold ${war.defenderScore > war.attackerScore ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {war.defenderScore}
                                    </span>
                                </div>
                                <div className="text-[0.65rem] text-[var(--color-text-muted)] text-center">
                                    {!timeRemaining.expired
                                        ? `До конца: ${timeRemaining.hours}ч ${timeRemaining.minutes}м`
                                        : 'Завершается...'}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
