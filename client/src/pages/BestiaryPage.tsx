import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { fetchMobs, attackMob } from '../api/mobs';
import { fetchCharacter } from '../api/character';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import BackButton from '../components/ui/BackButton';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { renderBattleLog } from '../utils/battleLog';

const rarityColors: Record<number, string> = {
    0: '#6b6b6b', 1: '#a0a0a0', 2: '#4a9b4a', 3: '#4a7ac0', 4: '#a040c0', 5: '#d4a020', 6: '#e03030',
};
const rarityNames: Record<number, string> = {
    0: 'Хлам', 1: 'Обычный', 2: 'Необычный', 3: 'Редкий', 4: 'Эпический', 5: 'Легендарный', 6: 'Мифический',
};

export default function BestiaryPage() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();

    const [mobs, setMobs] = useState<any[]>([]);
    const [selectedMob, setSelectedMob] = useState<any>(null);
    const [battleResult, setBattleResult] = useState<any>(null);
    const [battleSteps, setBattleSteps] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filterLocation, setFilterLocation] = useState('');

    useEffect(() => { if (!user) navigate('/login'); }, [user]);
    useEffect(() => { loadMobs(); }, []);

    const loadMobs = async () => {
        try { setMobs(await fetchMobs()); } catch (e: any) { setError(e.message); }
    };

    const handleAttack = async () => {
        if (!selectedMob) return;
        setLoading(true); setError(''); setBattleSteps([]); setBattleResult(null);
        try {
            const result = await attackMob(selectedMob.id);
            setBattleResult(result);
            setBattleSteps(result.steps || []);
            const fresh = await fetchCharacter();
            setCharacter(fresh);
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const locations = [...new Set(mobs.map(m => m.location))];

    const filteredMobs = filterLocation
        ? mobs.filter(m => m.location === filterLocation)
        : mobs;

    return (
        <div className="px-4 py-4 max-w-4xl mx-auto">
            <BackButton to="/" />
            <h1 className="text-xl font-bold mb-4"><Icon icon="game-icons:death-skull" width="22" height="22" className="inline mr-2" />Бестиарий</h1>

            {error && <p className="text-red-500 mb-4">{error}</p>}

            {/* Фильтр по локациям */}
            <div className="flex gap-2 mb-4 flex-wrap">
                <Button variant={filterLocation === '' ? 'primary' : 'secondary'} size="xs" onClick={() => setFilterLocation('')}>Все</Button>
                {locations.map(loc => (
                    <Button key={loc} variant={filterLocation === loc ? 'primary' : 'secondary'} size="xs" onClick={() => setFilterLocation(loc)}>
                        {loc}
                    </Button>
                ))}
            </div>

            {/* Бой */}
            {battleSteps.length > 0 && (
                <Card className="mb-4">
                    <h3 className="font-bold mb-2">
                        {battleResult?.playerWon ? (
                            <><Icon icon="game-icons:trophy" width="16" height="16" className="inline mr-1" />Победа!</>
                        ) : (
                            <><Icon icon="game-icons:death-skull" width="16" height="16" className="inline mr-1" />Поражение</>
                        )}
                    </h3>
                    <div className="bg-black rounded-lg p-3 max-h-[20em] overflow-y-auto font-mono text-xs leading-relaxed mb-3">
                        {renderBattleLog(battleSteps)}
                    </div>
                    {battleResult?.playerWon && (
                        <div className="text-sm space-y-1 mb-3">
                            <p>Опыт: +{battleResult.xpGained}</p>
                            <p>Золото: +{battleResult.goldGained} 🥇</p>
                            {battleResult.levelsGained > 0 && (
                                <p className="text-[var(--color-accent-purple)]">Уровень +{battleResult.levelsGained}</p>
                            )}
                            {battleResult.materialDropped && (
                                <p style={{ color: rarityColors[battleResult.materialDropped.rarity_id] }}>
                                    Добыто: {battleResult.materialDropped.name}
                                </p>
                            )}
                        </div>
                    )}
                    {!battleResult?.playerWon && battleResult?.goldLost > 0 && (
                        <p className="text-red-500 text-sm mb-3">Потеряно: {battleResult.goldLost} 🥇</p>
                    )}
                    <Button variant="secondary" size="sm" onClick={() => { setBattleSteps([]); setBattleResult(null); }}>
                        Закрыть
                    </Button>
                </Card>
            )}

            {/* Сетка мобов */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMobs.map((mob: any) => (
                    <Card key={mob.id} className="cursor-pointer hover:border-[var(--color-accent-info)]" onClick={() => setSelectedMob(mob)}>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-sm">{mob.name}</h3>
                            <span className="text-xs text-[var(--color-text-muted)]">Ур. {mob.level}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-xs text-[var(--color-text-muted)] mb-2">
                            <span>HP: {mob.hp}</span>
                            <span>ATK: {mob.atk}</span>
                            <span>AGI: {mob.agi}</span>
                            <span>DEF: {mob.def}</span>
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                            <span>XP: {mob.xp > 0 ? `+${mob.xp}` : '—'}</span>
                            <span className="ml-3">🥇 {mob.gold_min}–{mob.gold_max}</span>
                            <span className="ml-3 text-[var(--color-text-muted)]">{mob.location}</span>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Модалка выбранного моба */}
            {selectedMob && !battleSteps.length && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setSelectedMob(null)}>
                    <Card className="max-w-sm mx-4" onClick={e => e.stopPropagation()}>
                        <h2 className="text-lg font-bold mb-2"><Icon icon="game-icons:death-skull" width="18" height="18" className="inline mr-1" />{selectedMob.name}</h2>
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                            <p>Уровень: <strong>{selectedMob.level}</strong></p>
                            <p>HP: <strong>{selectedMob.hp}</strong></p>
                            <p>Сила: <strong>{selectedMob.atk}</strong></p>
                            <p>Ловкость: <strong>{selectedMob.agi}</strong></p>
                            <p>Защита: <strong>{selectedMob.def}</strong></p>
                            <p>Мастерство: <strong>{selectedMob.mst}</strong></p>
                        </div>
                        <div className="text-sm text-[var(--color-text-muted)] mb-3">
                            <p>Награда: {selectedMob.xp > 0 ? `+${selectedMob.xp} XP` : 'без XP'}, 🥇 {selectedMob.gold_min}–{selectedMob.gold_max}</p>
                            <p>Локация: {selectedMob.location}</p>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="danger" fullWidth onClick={handleAttack} disabled={loading}>
                                {loading ? '...' : <><Icon icon="game-icons:crossed-swords" width="16" height="16" className="inline mr-1" />В бой!</>}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setSelectedMob(null)}>Закрыть</Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
