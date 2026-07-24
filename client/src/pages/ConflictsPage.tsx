import { useState, useEffect } from 'react';
import PageHeader from '../components/ui/PageHeader';
import BackButton from '../components/BackButton';
import Card from '../components/ui/Card';
import { getHeaders } from '../api/helpers';
import { useNavigate } from 'react-router-dom';

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
        <div className="max-w-2xl mx-auto px-4 py-4">
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
                        const expiresIn = Math.max(0, new Date(war.expiresAt).getTime() - Date.now());
                        const hoursLeft = Math.floor(expiresIn / (1000 * 60 * 60));
                        const minsLeft = Math.floor((expiresIn % (1000 * 60 * 60)) / (1000 * 60));

                        return (
                            <Card key={war.id} className="p-4">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <span
                                        className="text-sm font-bold cursor-pointer hover:text-[var(--color-accent-info)] truncate"
                                        onClick={() => navigate(`/guild/${war.attackerGuild.id}`)}
                                    >{war.attackerGuild.name}</span>
                                    <span className="text-lg font-bold text-[var(--color-accent-danger)]">VS</span>
                                    <span
                                        className="text-sm font-bold cursor-pointer hover:text-[var(--color-accent-info)] truncate"
                                        onClick={() => navigate(`/guild/${war.defenderGuild.id}`)}
                                    >{war.defenderGuild.name}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className={`text-xl font-bold ${war.attackerScore > war.defenderScore ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {war.attackerScore}
                                    </span>
                                    <span className="text-xs text-[var(--color-text-muted)]">Счёт</span>
                                    <span className={`text-xl font-bold ${war.defenderScore > war.attackerScore ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-text-muted)]'}`}>
                                        {war.defenderScore}
                                    </span>
                                </div>
                                <div className="text-[0.65rem] text-[var(--color-text-muted)] text-right">
                                    {expiresIn > 0
                                        ? `До конца: ${hoursLeft}ч ${minsLeft}м`
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
