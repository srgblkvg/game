import { useState, useEffect } from 'react';
import { getHeaders } from '../api/helpers';
import { useGame } from '../contexts/GameContext';
import { fetchCharacter } from '../api';
import BackButton from '../components/BackButton';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { Icon } from '@iconify/react';

const FACTIONS: Record<string, { icon: string; color: string; bgColor: string; name: string; desc: string; bonus: string }> = {
    bandit: { icon: 'game-icons:hood', color: 'text-red-300', bgColor: 'border-[#5a2828]', name: 'Бандиты', desc: 'Грабители и налётчики. Сильны в PvP против ремесленников.', bonus: '+10% к основным характеристикам против Ремесленников. Атаки ±4 уровня. +1% дополнительного награбленного серебра за каждые 100 побед в PvP. Кулдаун между атаками в PvP уменьшен в два раза.' },
    crafter: { icon: 'game-icons:anvil', color: 'text-blue-300', bgColor: 'border-[#28285a]', name: 'Ремесленники', desc: 'Мастера и торговцы. Лучшие в крафте и заработке.', bonus: '+10% шанс создания/улучшения +1% за 100 успешных созданных и улучшенных предметов. +100% награда за работы.' },
    guard: { icon: 'game-icons:shield', color: 'text-yellow-300', bgColor: 'border-[#5a5a28]', name: 'Стражники', desc: 'Защитники порядка. Эффективны против бандитов и монстров.', bonus: '+10% к основным характеристикам против Бандитов и в PvE. Карма: +1 за победу над бандитом или монстром, -1 за победу над мирным игроком. +1% к жалованию за очко кармы.' },
};

export default function FactionPage() {
    const { character, setCharacter } = useGame();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [changeTarget, setChangeTarget] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/faction', { headers: getHeaders() }).then(r => r.json()).then(setData).catch(() => {});
    }, []);

    useEffect(() => {
        if (data?.current) {
            fetch(`/api/faction/top/${data.current}`, { headers: getHeaders() })
                .then(r => r.json()).then(d => setTopUsers(d.users || [])).catch(() => {});
        }
    }, [data?.current]);

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
            setChangeTarget(null);
        } catch { setMessage('Ошибка сети'); }
        finally { setLoading(false); }
    };

    const confirmChange = () => {
        if (changeTarget) handleChange(changeTarget);
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
                    {currentFaction === 'guard' && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-[var(--color-text-muted)]">Карма</span>
                                <span className={`text-xs font-bold ${(character?.karma || 0) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                                    {(character?.karma || 0) >= 0 ? '+' : ''}{character?.karma || 0}
                                </span>
                            </div>
                            <div className="w-full h-2 bg-[var(--color-bg-input)] rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all"
                                    style={{
                                        width: `${50 + (character?.karma || 0) / 2}%`,
                                        background: 'linear-gradient(to right, #dc2626, #eab308, #22c55e)',
                                    }}
                                />
                            </div>
                            <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-1">
                                +1 за победу над Бандитом или мобом, -1 за победу над мирным или Стражем. Карма влияет на жалование: от -100% до +100%.
                            </p>
                        </div>
                    )}
                    {currentFaction === 'bandit' && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Репутация: <span className="text-red-300 font-bold">{character?.banditReputation || 0}</span>
                            </p>
                            <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                                +1 за победу в PvP. Каждые 100 очков дают +1% к награбленному серебру.
                            </p>
                        </div>
                    )}
                    {currentFaction === 'crafter' && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
                            <p className="text-xs text-[var(--color-text-muted)]">
                                Ремесленный опыт: <span className="text-blue-300 font-bold">{character?.factionCraftCount || 0}</span>
                            </p>
                            <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-0.5">
                                +1% к шансу крафта/улучшения за 100 опыта. Опыт: +1 за успех при шансе &lt; 80%
                            </p>
                        </div>
                    )}
                    {/* Топ-5 фракции */}
                    {topUsers.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
                            <p className="text-xs text-[var(--color-text-muted)] font-bold mb-1">
                                {currentFaction === 'bandit' ? '🏆 Репутация' : currentFaction === 'crafter' ? '🏆 Ремесленный опыт' : '🏆 Карма'}
                            </p>
                            {topUsers.map((u: any, i: number) => (
                                <div key={u.id} className="flex items-center justify-between text-[0.6rem] text-[var(--color-text-muted)] py-0.5">
                                    <span className="truncate">{i + 1}. {u.username} [{u.level}]</span>
                                    <span className="font-bold flex-shrink-0 ml-2">{u.value?.toLocaleString() || 0}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {data?.changeCost && (
                        <div className="mt-3 pt-2 border-t border-[var(--color-border-light)]">
                            <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-2">
                                Смена фракции: {data.changeCost.toLocaleString()} серебра (карма, ремесленный опыт и репутация будут утеряны)
                            </p>
                            {message && <p className="text-xs text-[var(--color-accent-danger)] mb-2">{message}</p>}
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(FACTIONS).filter(([k]) => k !== currentFaction).map(([key, info]) => (
                                    <Button
                                        key={key}
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setChangeTarget(key)}
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
                    {/* Диаграмма участников */}
                    {data?.memberCounts && (() => {
                        const counts = data.memberCounts;
                        const total = (counts.bandit || 0) + (counts.crafter || 0) + (counts.guard || 0);
                        if (total > 0) {
                            const colors: Record<string, string> = { bandit: '#991b1b', crafter: '#60a5fa', guard: '#a16207' };
                            return (
                                <div className="mb-4 p-2 bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border-light)]">
                                    <div className="flex h-3 rounded-full overflow-hidden mb-1">
                                        {(['bandit', 'crafter', 'guard'] as const).map(f => (
                                            <div key={f} style={{ width: `${(counts[f] || 0) / total * 100}%`, background: colors[f], minWidth: counts[f] > 0 ? '2px' : '0' }} />
                                        ))}
                                    </div>
                                    <div className="flex justify-between text-[0.55rem] text-[var(--color-text-muted)]">
                                        <span style={{ color: '#f87171' }}>Бандиты: {counts.bandit || 0}</span>
                                        <span style={{ color: colors.crafter }}>Ремесленники: {counts.crafter || 0}</span>
                                        <span style={{ color: colors.guard }}>Стражники: {counts.guard || 0}</span>
                                    </div>
                                </div>
                            );
                        }
                        return null;
                    })()}
                    {message && <p className="text-xs text-[var(--color-accent-danger)] mb-3">{message}</p>}
                    <div className="space-y-3">
                        {Object.entries(FACTIONS).map(([key, info]) => (
                            <Card key={key} className={`p-4 border ${info.bgColor}`}>
                                <div className="flex items-center gap-3 mb-2">
                                    <Icon icon={info.icon} width="32" height="32" className={info.color} />
                                    <h3 className={`font-bold ${info.color}`}>{info.name}</h3>
                                </div>
                                <p className="text-xs text-[var(--color-text-muted)] mb-2">{info.desc}</p>
                                <p className="text-xs text-[var(--color-text-muted)] mb-1 border-t border-[var(--color-border-light)] pt-2">{info.bonus}</p>
                                <p className="text-[0.6rem] text-[var(--color-text-muted)] mb-3">
                                    Участников: {data?.memberCounts?.[key] ?? '...'}
                                </p>
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

            {/* Модалка подтверждения смены фракции */}
            <Modal
                open={changeTarget !== null}
                onClose={() => setChangeTarget(null)}
                title="Смена фракции"
                borderColor="var(--color-accent-warning)"
            >
                <div className="text-sm text-[var(--color-text-muted)] space-y-3">
                    <p>
                        Вы собираетесь вступить во фракцию{' '}
                        <span className={`font-bold ${changeTarget ? FACTIONS[changeTarget]?.color : ''}`}>
                            {changeTarget ? FACTIONS[changeTarget]?.name : ''}
                        </span>.
                    </p>
                    <div className="bg-[var(--color-bg-input)] rounded p-3 text-xs space-y-1">
                        <p className="font-bold text-[var(--color-accent-warning)]">⚠️ Внимание:</p>
                        <p>• Стоимость смены: <span className="font-bold">{data?.changeCost?.toLocaleString() || '10 000'} серебра</span></p>
                        <p>• Карма, ремесленный опыт и репутация будут <span className="text-[var(--color-accent-danger)]">безвозвратно утеряны</span></p>
                        <p>• Все счётчики фракции обнулятся</p>
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                        <Button variant="secondary" size="md" onClick={() => setChangeTarget(null)} disabled={loading}>
                            Отмена
                        </Button>
                        <Button variant="danger" size="md" onClick={confirmChange} disabled={loading}>
                            {loading ? '...' : 'Сменить фракцию'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
