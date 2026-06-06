import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchBattles, fetchCharacter } from '../api';
import Button from './ui/Button';

export default function Header() {
    const { user } = useAuth();
    const { character, setCharacter } = useGame();
    const navigate = useNavigate();
    const [hasNewBattles, setHasNewBattles] = useState(false);
    const [protectionSec, setProtectionSec] = useState(0);

    useEffect(() => {
        if (!user || user.role === 'admin') return;

        const checkForNewBattles = () => {
            const lastSeen = parseInt(localStorage.getItem('lastHistorySeen') || '0');
            fetchBattles(1)
                .then((battles: any[]) => {
                    if (battles.length > 0) {
                        const lastBattleTime = new Date(battles[0].createdAt + 'Z').getTime();
                        if (lastBattleTime > lastSeen) {
                            setHasNewBattles(true);
                        }
                    }
                })
                .catch(console.error);
        };

        checkForNewBattles();
        fetchCharacter().then(setCharacter).catch(console.error);
        const interval = setInterval(() => {
            checkForNewBattles();
            fetchCharacter().then(setCharacter).catch(console.error);
        }, 10000);

        return () => clearInterval(interval);
    }, [user, setCharacter]);

    useEffect(() => {
        if (!character || !user || user.role !== 'player') return;
        const update = () => {
            const now = Math.floor(Date.now() / 1000);
            const remaining = Math.max(0, (character.protectionUntil || 0) - now);
            setProtectionSec(remaining);
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [character, user]);

    const handleHistoryClick = () => {
        localStorage.setItem('lastHistorySeen', Date.now().toString());
        setHasNewBattles(false);
        navigate('/history');
    };

    if (!user) return null;

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)] flex-wrap">
            {user.role === 'player' && character && (
                <span className="text-white text-sm font-bold">
                    Серебро: {character.money.toLocaleString()}
                </span>
            )}
            {user.role === 'player' && (
                protectionSec > 0 ? (
                    <span className="text-[var(--color-accent-info)] text-xs px-2 py-0.5 rounded-xl flex items-center gap-1" style={{ background: 'rgba(52, 152, 219, 0.15)' }}>
                        <Icon icon="game-icons:shield" width="18" height="18" />
                        {formatTime(protectionSec)}
                    </span>
                ) : (
                    <span className="text-[var(--color-text-muted)] text-xs px-2 py-0.5 rounded-xl flex items-center gap-1" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                        <Icon icon="game-icons:shield-disabled" width="18" height="18" />
                        нет защиты
                    </span>
                )
            )}
            <div className="flex gap-2 ml-auto">
                {user.role === 'player' && (
                    <>
                        <Button size="xs" onClick={() => navigate('/account')}>
                            <span className="flex items-center gap-1">
                                <Icon icon="game-icons:person" width="18" height="18" />
                                Аккаунт
                            </span>
                        </Button>
                        <Button
                            size="xs"
                            onClick={handleHistoryClick}
                            className={hasNewBattles ? 'blink' : ''}
                        >
                            <span className="flex items-center gap-1">
                                {hasNewBattles && <Icon icon="game-icons:bell" width="18" height="18" />}
                                <Icon icon="game-icons:notebook" width="18" height="18" />
                                Сводка
                            </span>
                        </Button>
                        <a href="https://vk.com/club239320810" target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-semibold bg-[#0077FF] text-white hover:bg-[#0066DD] transition-colors"
                            title="Сообщество VK">
                            <Icon icon="mdi:vk" width="20" height="20" />
                        </a>
                    </>
                )}
                {user.role === 'admin' && (
                    <Button variant="danger" size="sm" onClick={() => navigate('/adminpanel')}>
                        <span className="flex items-center gap-1">
                            <Icon icon="game-icons:shield" width="18" height="18" />
                            Панель администратора
                        </span>
                    </Button>
                )}
            </div>
        </div>
    );
}
