import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

interface ActionsProps {
    canAttack: boolean;
    attackCooldownSec: number;
    onArenaClick: () => void;
}

export default function Actions({ canAttack, attackCooldownSec, onArenaClick }: ActionsProps) {
    const navigate = useNavigate();
    const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 600);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    const cards = [
        {
            title: '🛒 Магазин',
            subtitle: 'Снаряжение',
            cost: 0,
            action: () => navigate('/shop'),
            buttonText: 'Перейти',
            bgImage: 'url(/action_shop.webp)',
        },
        {
            title: '⚔️ Разбой',
            subtitle: 'Бой с игроками',
            cost: 10,
            action: onArenaClick,
            disabled: !canAttack,
            buttonText: canAttack ? 'В бой' : `⏳ ${Math.floor(attackCooldownSec / 60)}:${String(attackCooldownSec % 60).padStart(2, '0')}`,
            bgImage: 'url(/action_arena.webp)',
        },
        {
            title: '🛠️ Приключения',
            subtitle: 'Заработок',
            cost: 0,
            action: () => navigate('/jobs'),
            buttonText: 'Выбрать',
            bgImage: 'url(/action_adventures.webp)',
        },
        {
            title: '🔨 Крафт',
            subtitle: 'Разбор и создание',
            cost: 0,
            action: () => navigate('/craft'),
            buttonText: 'Перейти',
            bgImage: 'url(/action_craft.webp)',
        },
    ];

    return (
        <div style={{
            marginTop: '1.5rem',
            width: '100%',
        }}>
            <div className={isMobile ? 'hide-scrollbar' : ''} style={{
                display: 'flex',
                flexWrap: isMobile ? 'nowrap' : 'wrap',
                gap: '0.75rem',
                justifyContent: isMobile ? 'flex-start' : 'center',
                overflowX: isMobile ? 'auto' : 'visible',
                scrollSnapType: isMobile ? 'x mandatory' : 'none',
                paddingBottom: isMobile ? '0.5rem' : 0,
            }}>
                {cards.map((card, i) => (
                    <div key={i} style={{
                        background: '#1e1e30',
                        borderRadius: '10px',
                        padding: '1rem',
                        width: isMobile ? '180px' : undefined,
                        maxWidth: '250px',
                        flex: isMobile ? '0 0 auto' : '1 1 200px',
                        border: '2px solid #555',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                        flexShrink: 0,
                        scrollSnapAlign: isMobile ? 'start' : 'none',
                    }}>
                        <div style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundImage: card.bgImage,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            opacity: 0.25,
                            zIndex: 0,
                        }} />
                        <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
                            <h3 style={{ margin: '0 0 0.3rem 0', fontSize: '0.95rem' }}>{card.title}</h3>
                            <p style={{ fontSize: '0.75rem', color: '#aaa', margin: '0.2rem 0' }}>{card.subtitle}</p>
                            {card.cost > 0 && (
                                <p style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.4rem' }}>{card.cost} бронзы</p>
                            )}
                            {card.cost === 0 && <div style={{ marginBottom: '0.4rem' }} />}
                            <button
                                onClick={card.action}
                                disabled={card.disabled}
                                style={{
                                    background: card.disabled ? '#555' : '#e63946',
                                    border: 'none', borderRadius: '5px',
                                    color: card.disabled ? '#888' : '#fff',
                                    padding: '0.35rem 1rem', fontSize: '0.8rem',
                                    fontWeight: 'bold', cursor: card.disabled ? 'not-allowed' : 'pointer',
                                    opacity: card.disabled ? 0.7 : 1,
                                }}>
                                {card.buttonText}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}