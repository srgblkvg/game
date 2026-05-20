import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { fetchBattles, fetchCharacter } from '../api';
import { MoneyDisplay } from './MoneyDisplay';

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
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#1e1e30',
                borderBottom: '1px solid #444',
            }}>
                <div />
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                    {user.role === 'player' && (
                        <>
                            <button onClick={() => navigate('/account')} style={{
                                background: '#555', border: 'none', color: '#fff', padding: '0.2rem 0.6rem',
                                borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
                            }}>
                                👤 Аккаунт
                            </button>
                            <button onClick={handleHistoryClick} className={hasNewBattles ? 'blink' : ''} style={{
                                background: '#555', border: 'none', color: '#fff', padding: '0.2rem 0.6rem',
                                borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
                            }}>
                                {hasNewBattles ? '🔔 ' : ''}📜 Уведомления
                            </button>
                        </>
                    )}
                    {user.role === 'admin' && (
                        <button onClick={() => navigate('/adminpanel')} style={{
                            background: '#e63946', border: 'none', color: '#fff', padding: '0.2rem 0.6rem',
                            borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem',
                        }}>
                            🛡 Панель администратора
                        </button>
                    )}
                </div>
            </div>

            {user.role === 'player' && (
                <div style={{
                    textAlign: 'center',
                    padding: '0.3rem 0',
                    background: '#1e1e30',
                    borderBottom: '1px solid #444',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                }}>
                    {character && (
                        <span style={{ color: '#f1c40f', fontSize: '0.9rem', fontWeight: 'bold' }}>
                            Деньги: <MoneyDisplay money={character.money} />
                        </span>
                    )}
                    {protectionSec > 0 && (
                        <span style={{
                            color: '#3498db',
                            fontSize: '0.85rem',
                            background: 'rgba(52, 152, 219, 0.15)',
                            padding: '0.2rem 1rem',
                            borderRadius: '12px',
                        }}>
                            🛡 Защита: {formatTime(protectionSec)}
                        </span>
                    )}
                </div>
            )}
        </>
    );
}