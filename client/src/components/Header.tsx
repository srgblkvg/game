import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchBattles, fetchCharacter } from '../api';
import { MoneyDisplay } from './MoneyDisplay';
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
        const interval = setInterval(() => {
            checkForNewBattles();
            fetchCharacter().then(setCharacter).catch(console.error);
        }, 5000);

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
        <>
            {/* Верхняя панель */}
            <div className="flex justify-between items-center gap-2 px-4 py-2 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
                <div />
                <div className="flex gap-2 ml-auto">
                    {user.role === 'player' && (
                        <>
                            <Button size="xs" onClick={() => navigate('/account')}>
                                👤 Аккаунт
                            </Button>
                            <Button
                                size="xs"
                                onClick={handleHistoryClick}
                                className={hasNewBattles ? 'blink' : ''}
                            >
                                {hasNewBattles ? '🔔 ' : ''}📜 Уведомления
                            </Button>
                        </>
                    )}
                    {user.role === 'admin' && (
                        <Button variant="danger" size="sm" onClick={() => navigate('/adminpanel')}>
                            🛡 Панель администратора
                        </Button>
                    )}
                </div>
            </div>

            {user.role === 'player' && (
                <>
                    {/* Строка с деньгами */}
                    <div className="text-center py-1.5 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
                        {character && (
                            <span className="text-[var(--color-text-accent)] text-sm font-bold">
                                Деньги: <MoneyDisplay money={character.money} />
                            </span>
                        )}
                    </div>

                    {/* Строка с таймером защиты */}
                    {protectionSec > 0 && (
                        <div className="text-center py-1 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)]">
                            <span
                                className="text-[var(--color-accent-info)] text-sm px-4 py-0.5 rounded-xl"
                                style={{ background: 'rgba(52, 152, 219, 0.15)' }}
                            >
                                🛡 Защита: {formatTime(protectionSec)}
                            </span>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
