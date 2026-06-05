import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Icon } from '@iconify/react';
import { formatMoney } from '../utils/money';
import Button from './ui/Button';

interface ActionsProps {
    canAttack: boolean;
    attackCooldownSec: number;
    pveCooldownSec: number;
    bankCooldownSec: number;
    onArenaClick: () => void;
}

interface ActionCard {
    icon: string; title: string; subtitle: string; cost: number;
    path: string | null; buttonText: string; bgClass: string; variant: 'danger';
}

const outsideCards: ActionCard[] = [
    { icon: 'game-icons:death-skull', title: 'Охота', subtitle: 'Бестиарий (PvE)', cost: 0, path: '/bestiary', buttonText: 'Перейти', bgClass: 'url(/action_arena.webp)', variant: 'danger' },
    { icon: 'game-icons:swap-bag', title: 'Работы', subtitle: 'Экспедиции', cost: 0, path: '/jobs', buttonText: 'Выбрать', bgClass: 'url(/action_adventures.webp)', variant: 'danger' },
];

const castleCards: ActionCard[] = [
    { icon: 'game-icons:crossed-swords', title: 'Арена', subtitle: 'PvP бой', cost: 10, path: null, buttonText: 'В бой', bgClass: 'url(/action_arena.webp)', variant: 'danger' },
    { icon: 'game-icons:buy-card', title: 'Магазин', subtitle: 'Снаряжение', cost: 0, path: '/shop', buttonText: 'Перейти', bgClass: 'url(/action_shop.webp)', variant: 'danger' },
    { icon: 'game-icons:bank', title: 'Банк', subtitle: 'Хранилище', cost: 0, path: '/bank', buttonText: 'Перейти', bgClass: 'url(/action_craft.webp)', variant: 'danger' },
    { icon: 'game-icons:anvil', title: 'Крафт', subtitle: 'Улучшения', cost: 0, path: '/craft', buttonText: 'Перейти', bgClass: 'url(/action_craft.webp)', variant: 'danger' },
    { icon: 'game-icons:auction', title: 'Аукцион', subtitle: 'Торги', cost: 0, path: '/auction', buttonText: 'Перейти', bgClass: 'url(/action_shop.webp)', variant: 'danger' },
    { icon: 'game-icons:drink-me', title: 'Трактир', subtitle: 'Лечение и квесты', cost: 0, path: '/tavern', buttonText: 'Перейти', bgClass: 'url(/action_adventures.webp)', variant: 'danger' },
];

const diffLabels: Record<string, string> = { easy: 'Лёгкий', equal: 'Равный', hard: 'Сложный' };
const diffIcons: Record<string, string> = { easy: 'game-icons:broken-shield', equal: 'game-icons:crossed-swords', hard: 'game-icons:death-skull' };

function CardGrid({ cards, canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, onArenaClick, navigate }: {
    cards: ActionCard[]; canAttack: boolean; attackCooldownSec: number; pveCooldownSec: number; bankCooldownSec: number;
    onArenaClick: () => void; navigate: (path: string) => void;
}) {
    const [arenaDifficulty, setArenaDifficulty] = useState<string>('equal');

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {cards.map((card, i) => {
                const isArena = card.path === null;
                const isHunt = card.path === '/bestiary';
                const isBank = card.path === '/bank';
                const huntDisabled = isHunt && pveCooldownSec > 0;
                const arenaDisabled = isArena && !canAttack;
                const bankDisabled = isBank && bankCooldownSec > 0;
                const disabled = arenaDisabled || huntDisabled || bankDisabled;
                const cdSec = isArena ? attackCooldownSec : isHunt ? pveCooldownSec : isBank ? bankCooldownSec : 0;
                const btnText = disabled && cdSec > 0
                    ? `${Math.floor(cdSec / 60)}:${String(cdSec % 60).padStart(2, '0')}`
                    : card.buttonText;

                // Для арены — flip-card
                if (isArena) {
                    return <ArenaFlipCard key={i} card={card} disabled={disabled} cdSec={cdSec} btnText={btnText}
                        arenaDifficulty={arenaDifficulty} setArenaDifficulty={setArenaDifficulty} navigate={navigate} />;
                }

                return (
                    <div key={i} className="relative bg-[var(--color-bg-secondary)] rounded-xl p-2 border border-[var(--color-border-default)] flex flex-col items-center text-center overflow-hidden">
                        <div className="absolute inset-0 bg-cover bg-center opacity-20 z-0" style={{ backgroundImage: card.bgClass }} />
                        <div className="relative z-10 w-full flex flex-col flex-1">
                            <h3 className="text-[0.8rem] font-bold mb-0.5 flex items-center justify-center gap-1">
                                <Icon icon={card.icon} width="14" height="14" />{card.title}
                            </h3>
                            <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                            <div className="mt-auto">
                                {card.cost > 0 && <p className="text-[0.6rem] text-[var(--color-text-muted)]">Цена: {formatMoney(card.cost)}</p>}
                                <Button variant={disabled ? 'secondary' : 'danger'} size="xs" fullWidth disabled={disabled}
                                    onClick={() => { if (card.path) navigate(card.path); }}>
                                    {disabled && cdSec > 0 ? <span className="flex items-center justify-center gap-1"><Icon icon="game-icons:hourglass" width="12" height="12" />{btnText}</span> : btnText}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function ArenaFlipCard({ card, disabled, cdSec, btnText, arenaDifficulty, setArenaDifficulty, navigate }: {
    card: ActionCard; disabled: boolean; cdSec: number; btnText: string;
    arenaDifficulty: string; setArenaDifficulty: (d: string) => void; navigate: (path: string) => void;
}) {
    const [flipped, setFlipped] = useState(false);

    return (
        <div className="perspective-600">
            <div className={`relative w-full transition-transform duration-400 ${flipped ? 'rotate-y-180' : ''}`} style={{ transformStyle: 'preserve-3d' }}>
                {/* Front */}
                <div className="relative bg-[var(--color-bg-secondary)] rounded-xl p-2 border border-[var(--color-border-default)] flex flex-col items-center text-center overflow-hidden" style={{ backfaceVisibility: 'hidden' }}>
                    <div className="absolute inset-0 bg-cover bg-center opacity-20 z-0" style={{ backgroundImage: card.bgClass }} />
                    <div className="relative z-10 w-full flex flex-col flex-1">
                        <h3 className="text-[0.8rem] font-bold mb-0.5 flex items-center justify-center gap-1">
                            <Icon icon={card.icon} width="14" height="14" />{card.title}
                        </h3>
                        <p className="text-[0.65rem] text-[var(--color-text-muted)] mb-1">{card.subtitle}</p>
                        <div className="mt-auto">
                            {card.cost > 0 && <p className="text-[0.6rem] text-[var(--color-text-muted)]">Цена: {formatMoney(card.cost)}</p>}
                            <Button variant={disabled ? 'secondary' : 'danger'} size="xs" fullWidth disabled={disabled}
                                onClick={() => { if (!disabled) setFlipped(true); }}>
                                {disabled && cdSec > 0 ? <span className="flex items-center justify-center gap-1"><Icon icon="game-icons:hourglass" width="12" height="12" />{btnText}</span> : btnText}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Back */}
                <div className="absolute inset-0 bg-[var(--color-bg-secondary)] rounded-xl p-2 border border-[var(--color-border-default)] flex flex-col items-center justify-center gap-2" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <p className="text-[0.65rem] text-[var(--color-text-muted)]">Сложность соперника:</p>
                    <select
                        value={arenaDifficulty}
                        onChange={e => setArenaDifficulty(e.target.value)}
                        className="bg-[var(--color-bg-input)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] rounded px-2 py-1 text-xs w-full"
                    >
                        <option value="easy">Лёгкий (ниже ур.)</option>
                        <option value="equal">Равный</option>
                        <option value="hard">Сложный (выше ур.)</option>
                    </select>
                    <div className="flex gap-1 w-full">
                        <Button variant="danger" size="xs" fullWidth onClick={() => navigate(`/arena?difficulty=${arenaDifficulty}`)}>
                            Поиск
                        </Button>
                        <Button variant="secondary" size="xs" onClick={() => setFlipped(false)} style={{ minWidth: '24px' }}>
                            ←
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function Actions({ canAttack, attackCooldownSec, pveCooldownSec, bankCooldownSec, onArenaClick }: ActionsProps) {
    const navigate = useNavigate();
    return (
        <div className="mt-6 w-full max-w-2xl mx-auto space-y-4">
            <div>
                <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Icon icon="game-icons:castle-ruins" width="14" height="14" />🌍 За стенами
                </h2>
                <CardGrid cards={outsideCards} canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} onArenaClick={onArenaClick} navigate={navigate} />
            </div>
            <div className="border-t border-[var(--color-border-light)] pt-4">
                <h2 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Icon icon="game-icons:castle" width="14" height="14" />🏰 Площадь
                </h2>
                <CardGrid cards={castleCards} canAttack={canAttack} attackCooldownSec={attackCooldownSec} pveCooldownSec={pveCooldownSec} bankCooldownSec={bankCooldownSec} onArenaClick={onArenaClick} navigate={navigate} />
            </div>
        </div>
    );
}
