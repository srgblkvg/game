import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';

interface ActionsProps {
    canAttack: boolean;
    attackCooldownSec: number;
    onArenaClick: () => void;
}

const cards = [
    { title: '🛒 Магазин', subtitle: 'Снаряжение', cost: 0, path: '/shop', buttonText: 'Перейти', bgClass: 'url(/action_shop.webp)', variant: 'danger' as const },
    { title: '⚔️ Разбой', subtitle: 'Бой с игроками', cost: 10, path: null, buttonText: 'В бой', bgClass: 'url(/action_arena.webp)', variant: 'danger' as const },
    { title: '🛠️ Приключения', subtitle: 'Заработок', cost: 0, path: '/jobs', buttonText: 'Выбрать', bgClass: 'url(/action_adventures.webp)', variant: 'danger' as const },
    { title: '🔨 Крафт', subtitle: 'Разбор и создание', cost: 0, path: '/craft', buttonText: 'Перейти', bgClass: 'url(/action_craft.webp)', variant: 'danger' as const },
];

export default function Actions({ canAttack, attackCooldownSec, onArenaClick }: ActionsProps) {
    const navigate = useNavigate();

    return (
        <div className="mt-6 w-screen ml-[calc(-50vw+50%)] sm:w-full sm:ml-0">
            <div className="flex sm:flex-wrap gap-3 overflow-x-auto sm:overflow-visible justify-start sm:justify-center hide-scrollbar px-8">
                {cards.map((card, i) => {
                    const isArena = i === 1;
                    const disabled = isArena && !canAttack;
                    const buttonText = isArena && !canAttack
                        ? `⏳ ${Math.floor(attackCooldownSec / 60)}:${String(attackCooldownSec % 60).padStart(2, '0')}`
                        : card.buttonText;

                    return (
                        <div
                            key={i}
                            className="relative bg-[var(--color-bg-secondary)] rounded-xl p-4 border-2 border-[var(--color-border-default)] flex flex-col items-center text-center overflow-hidden w-[200px] sm:min-w-[200px] sm:max-w-[280px] sm:flex-1 flex-shrink-0 sm:flex-shrink"
                        >
                            {/* Фон */}
                            <div
                                className="absolute inset-0 bg-cover bg-center opacity-25 z-0"
                                style={{ backgroundImage: card.bgClass }}
                            />
                            <div className="relative z-10 w-full flex flex-col flex-1">
                                <div>
                                    <h3 className="text-[0.95rem] font-bold mb-1">{card.title}</h3>
                                    <p className="text-xs text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                                </div>
                                <div className="mt-auto">
                                    {card.cost > 0 && (
                                        <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-1">Цена: {card.cost} сер.</p>
                                    )}
                                    {card.cost === 0 && <div className="mb-1" />}
                                    <Button
                                        variant={disabled ? 'secondary' : 'danger'}
                                        size="xs"
                                        fullWidth
                                        disabled={disabled}
                                        onClick={() => {
                                            if (isArena) onArenaClick();
                                            else if (card.path) navigate(card.path);
                                        }}
                                    >
                                        {buttonText}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
