import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { formatMoney } from '../utils/money';
import Button from './ui/Button';

interface ActionsProps {
    canAttack: boolean;
    attackCooldownSec: number;
    onArenaClick: () => void;
}

const cards = [
    { icon: 'game-icons:buy-card', title: 'Магазин', subtitle: 'Снаряжение', cost: 0, path: '/shop', buttonText: 'Перейти', bgClass: 'url(/action_shop.webp)', variant: 'danger' as const },
    { icon: 'game-icons:crossed-swords', title: 'Разбой', subtitle: 'Бой с игроками', cost: 10, path: null, buttonText: 'В бой', bgClass: 'url(/action_arena.webp)', variant: 'danger' as const },
    { icon: 'game-icons:swap-bag', title: 'Приключения', subtitle: 'Заработок', cost: 0, path: '/jobs', buttonText: 'Выбрать', bgClass: 'url(/action_adventures.webp)', variant: 'danger' as const },
    { icon: 'game-icons:anvil', title: 'Крафт', subtitle: 'Разбор и создание', cost: 0, path: '/craft', buttonText: 'Перейти', bgClass: 'url(/action_craft.webp)', variant: 'danger' as const },
    { icon: 'game-icons:death-skull', title: 'Бестиарий', subtitle: 'Охота на мобов', cost: 0, path: '/bestiary', buttonText: 'Перейти', bgClass: 'url(/action_arena.webp)', variant: 'danger' as const },
];

export default function Actions({ canAttack, attackCooldownSec, onArenaClick }: ActionsProps) {
    const navigate = useNavigate();

    return (
        <div className="mt-6 w-screen ml-[calc(-50vw+50%)] sm:w-full sm:ml-0">
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 px-4 sm:px-0 max-w-lg mx-auto">
                {cards.map((card, i) => {
                    const isArena = i === 1;
                    const disabled = isArena && !canAttack;
                    const buttonText = isArena && !canAttack
                        ? `${Math.floor(attackCooldownSec / 60)}:${String(attackCooldownSec % 60).padStart(2, '0')}`
                        : card.buttonText;

                    return (
                        <div
                            key={i}
                            className="relative bg-[var(--color-bg-secondary)] rounded-xl p-3 border-2 border-[var(--color-border-default)] flex flex-col items-center text-center overflow-hidden"
                        >
                            <div
                                className="absolute inset-0 bg-cover bg-center opacity-25 z-0"
                                style={{ backgroundImage: card.bgClass }}
                            />
                            <div className="relative z-10 w-full flex flex-col flex-1">
                                <div>
                                    <h3 className="text-[0.95rem] font-bold mb-1 flex items-center justify-center gap-1">
                                        <Icon icon={card.icon} width="18" height="18" />
                                        {card.title}
                                    </h3>
                                    <p className="text-xs text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                                </div>
                                <div className="mt-auto">
                                    {card.cost > 0 && (
                                        <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-1">Цена: {formatMoney(card.cost)}</p>
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
                                        {isArena && !canAttack ? (
                                            <span className="flex items-center justify-center gap-1">
                                                <Icon icon="game-icons:hourglass" width="14" height="14" />
                                                {buttonText}
                                            </span>
                                        ) : buttonText}
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
