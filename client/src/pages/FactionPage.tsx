import { useState, useEffect } from 'react';
import { getHeaders } from '../api/helpers';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api';
import BackButton from '../components/BackButton';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Icon } from '@iconify/react';

const FACTIONS: Record<string, { icon: string; color: string; bgColor: string; name: string; desc: string; bonus: string }> = {
    bandit: { icon: 'game-icons:hood', color: 'text-red-300', bgColor: 'border-red-700/30', name: 'Бандиты', desc: 'Грабители и налётчики. Сильны в PvP против ремесленников.', bonus: '+10% характеристик против Ремесленников. Диапазон атак ±4 уровня.' },
    crafter: { icon: 'game-icons:anvil', color: 'text-blue-300', bgColor: 'border-blue-700/30', name: 'Ремесленники', desc: 'Мастера и торговцы. Лучшие в крафте и заработке.', bonus: '+10% шанс создания и улучшения предметов. +100% награда за работы.' },
    guard: { icon: 'game-icons:shield', color: 'text-yellow-300', bgColor: 'border-yellow-700/30', name: 'Стражники', desc: 'Защитники порядка. Эффективны против бандитов и монстров.', bonus: '+10% характеристик против Бандитов и в PvE. Жалование увеличено до 100%.' },
};

export default function FactionPage() {
    const { character, setCharacter } = useGame();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        fetch('/api/faction', { headers: getHeaders() }).then(r => r.json()).then(setData).catch(() => {});
    }, []);

    const handleChoose = async (faction: string) => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/faction/choose', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ faction }),
            });
            const d = await res.json();
            if (!res.ok) { setMessage(d.error || 'Ошибка'); return; }
            setData({ ...data, current: faction });
            const fresh = await fetchCharacter();
            setCharacter(fresh);
        } catch { setMessage('Ошибка сети'); }
        finally { setLoading(false); }
    };

    const handleChange = async (faction: string) => {
        setLoading(true);
        setMessage('');
        try {
            const res = await fetch('/api/faction/change', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ faction }),
            });
            const d = await res.json();
            if (!res.ok) { setMessage(d.error || 'Ошибка'); return; }
            setData({ ...data, current: faction });
            const fresh = await fetchCharacter();
            setCharacter(fresh);
        } catch { setMessage('Ошибка сети'); }
        finally { setLoading(false); }
    };

    if (!data) return <div className="p-4 max-w-md mx-auto"><BackButton /><p className="text-sm text-[var(--color-text-muted)]">Загрузка...</p></div>;

    const currentFaction = data.current;
    const canChoose = data.canChoose;

    return (
        <div className="p-4 max-w-md mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Icon icon="game-icons:swords-emblem" width="24" height="24" />
                Фракция
            </h1>

            {currentFaction ? (
                <Card className={`p-4 mb-4 border-2 ${FACTIONS[currentFaction]?.bgColor || ''}`}>
                    <div className="flex items-center gap-3 mb-3">
                        <Icon icon={FACTIONS[currentFaction]?.icon || 'game-icons:swords-emblem'} width="36" height="36" className={FACTIONS[currentFaction]?.color || ''} />
                        <div>
                            <h2 className={`font-bold text-lg ${FACTIONS[currentFaction]?.color || ''}`}>
                                {FACTIONS[currentFaction]?.name || currentFaction}
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)]">{FACTIONS[currentFaction]?.desc || ''}</p>
                        </div>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border-light)] pt-2">
                        {FACTIONS[currentFaction]?.bonus || ''}
                    </p>
                    {currentFaction === 'guard' && character?.karma !== undefined && (
                        <p className={`text-xs mt-1 font-bold ${character.karma >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                            Карма: {character.karma >= 0 ? '+' : ''}{character.karma}
                        </p>
                    )}
                    {data?.changeCost && (
                        <div className="mt-3 pt-2 border-t border-[var(--color-border-light)]">
                            <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-2">
                                Смена фракции: {data.changeCost.toLocaleString()} серебра (карма сбросится)
                            </p>
                            {message && <p className="text-xs text-[var(--color-accent-danger)] mb-2">{message}</p>}
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(FACTIONS).filter(([k]) => k !== currentFaction).map(([key, info]) => (
                                    <Button
                                        key={key}
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleChange(key)}
                                        disabled={loading}
                                    >
                                        {loading ? '...' : `В ${info.name}`}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>
            ) : canChoose ? (
                <>
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">
                        Выберите фракцию. Первый выбор бесплатный, смена — 10 000 серебра.
                    </p>
                    {message && <p className="text-xs text-[var(--color-accent-danger)] mb-3">{message}</p>}
                    <div className="space-y-3">
                        {Object.entries(FACTIONS).map(([key, info]) => (
                            <Card key={key} className={`p-4 border ${info.bgColor}`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Icon icon={info.icon} width="32" height="32" className={info.color} />
                                    <h3 className={`font-bold ${info.color}`}>{info.name}</h3>
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mb-2">{info.desc}</p>
                                <p className="text-xs text-[var(--color-text-muted)] mb-3 border-t border-[var(--color-border-light)] pt-2">{info.bonus}</p>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleChoose(key)}
                                    disabled={loading}
                                >
                                    {loading ? '...' : `Вступить в ${info.name}`}
                                </Button>
                            </Card>
                        ))}
                    </div>
                </>
            ) : (
                <p className="text-sm text-[var(--color-text-muted)]">
                    Фракции доступны с 5 уровня. Продолжайте играть!
                </p>
            )}
        </div>
    );
}
