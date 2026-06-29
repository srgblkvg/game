import { useState, useEffect } from 'react';
import BackButton from '../components/BackButton';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import { formatMoney } from '../utils/money';

const links = [
    { path: '/tournament', icon: 'game-icons:trophy-cup', title: 'Турниры', desc: 'Участвуйте в турнирах и выигрывайте призы' },
    { path: '/rating', icon: 'game-icons:rank-3', title: 'Рейтинг игроков', desc: 'Таблица лидеров PvP-арены' },
    { path: '/guild/rating', icon: 'game-icons:castle', title: 'Рейтинг гильдий', desc: 'Лучшие гильдии королевства' },
];

export default function CastlePage() {
    const navigate = useNavigate();
    const [treasury, setTreasury] = useState<number | null>(null);

    useEffect(() => {
        fetch('/api/treasury').then(r => r.json()).then(d => setTreasury(d.amount)).catch(() => {});
    }, []);

    return (
        <div className="px-4 py-4 max-w-md mx-auto">
            <BackButton />
            <h1 className="text-xl font-bold mb-4">
                <Icon icon="game-icons:castle" width="22" height="22" className="inline mr-2" />Замок
            </h1>

            <p className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] rounded p-2 mb-4">
                Турниры, рейтинги и состязания королевства.
            </p>

            {treasury !== null && (
                <div className="mb-4 p-3 bg-[var(--color-bg-card)] border border-[var(--color-accent-warning)] rounded-lg text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">Казна замка</p>
                    <p className="text-lg font-bold text-[var(--color-accent-warning)]">{formatMoney(treasury)}</p>
                    <p className="text-[0.6rem] text-[var(--color-text-muted)] mt-1">
                        Сборы с банка, магазина, аукциона и ремесла
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {links.map(link => (
                    <Card
                        key={link.path}
                        className="flex items-center gap-4 p-4 cursor-pointer hover:border-[var(--color-accent-info)] transition-colors"
                        onClick={() => navigate(link.path)}
                    >
                        <Icon icon={link.icon} width="28" height="28" className="text-[var(--color-accent-info)] shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm">{link.title}</h3>
                            <p className="text-xs text-[var(--color-text-muted)]">{link.desc}</p>
                        </div>
                        <Icon icon="game-icons:arrow-right" width="16" height="16" className="text-[var(--color-text-muted)] shrink-0" />
                    </Card>
                ))}
            </div>
        </div>
    );
}
