import { useState, useEffect } from 'react';
import Button from '../components/ui/Button';
import BackButton from '../components/BackButton';
import PageHeader from '../components/ui/PageHeader';
import { getHeaders } from '../api/helpers';
import { useToast } from '../contexts/ToastContext';
import { formatMoney } from '../utils/money';

const ENTRY_FEE = 10;
const MAX_REROLLS = 2;

interface GameState {
    gameId: number;
    dice: number[];
    rerollsUsed: number;
    entryFee: number;
}

interface FinishResult {
    dice: number[];
    combo: string;
    comboName: string;
    payout: number;
    profit: number;
}

const DICE_FACES: Record<number, string> = {
    1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅',
};

export default function DicePage() {
    const [game, setGame] = useState<GameState | null>(null);
    const [keep, setKeep] = useState<Set<number>>(new Set());
    const [result, setResult] = useState<FinishResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [canAfford, setCanAfford] = useState(true);
    const { showToast } = useToast();

    const toggleKeep = (idx: number) => {
        if (!game) return;
        const next = new Set(keep);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setKeep(next);
    };

    const startGame = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/dice/play', {
                method: 'POST',
                headers: getHeaders(),
            });
            const data = await r.json();
            if (!r.ok) {
                showToast(data.error || 'Ошибка', 'error');
                return;
            }
            setGame(data);
            setKeep(new Set());
            setResult(null);
        } catch {
            showToast('Ошибка соединения', 'error');
        } finally {
            setLoading(false);
        }
    };

    const reroll = async () => {
        if (!game || game.rerollsUsed >= MAX_REROLLS) return;
        setLoading(true);
        try {
            const r = await fetch('/api/dice/reroll', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: game.gameId, keep: [...keep] }),
            });
            const data = await r.json();
            if (!r.ok) {
                showToast(data.error || 'Ошибка', 'error');
                return;
            }
            setGame({ ...game, dice: data.dice, rerollsUsed: data.rerollsUsed });
            setKeep(new Set());
        } catch {
            showToast('Ошибка соединения', 'error');
        } finally {
            setLoading(false);
        }
    };

    const finish = async () => {
        if (!game) return;
        setLoading(true);
        try {
            const r = await fetch('/api/dice/finish', {
                method: 'POST',
                headers: { ...getHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ gameId: game.gameId }),
            });
            const data = await r.json();
            if (!r.ok) {
                showToast(data.error || 'Ошибка', 'error');
                return;
            }
            setResult(data);
            setGame(null);
            setKeep(new Set());
        } catch {
            showToast('Ошибка соединения', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Check if user can afford
    useEffect(() => {
        fetch('/api/character/me', { headers: getHeaders() })
            .then(r => r.json())
            .then(data => setCanAfford(data.money >= ENTRY_FEE))
            .catch(() => {});
    }, []);

    return (
        <div className="max-w-lg mx-auto px-3 py-4">
            <PageHeader title="Кости" breadcrumbs={[{ label: 'Кости' }]} />

            {!game && !result && (
                <div className="flex flex-col items-center gap-4 mt-8">
                    <div className="text-6xl">🎲</div>
                    <h2 className="text-lg font-bold">Покер на костях</h2>
                    <p className="text-sm text-[var(--color-text-secondary)] text-center">
                        Брось 5 кубиков. Оставь нужные, перебрось остальные<br />
                        (до {MAX_REROLLS} раз). Собери комбинацию!
                    </p>
                    <div className="text-xs text-[var(--color-text-secondary)] space-y-1 text-center">
                        <div>Покер (5 одинак.) — ×50</div>
                        <div>Каре (4 одинак.) — ×20</div>
                        <div>Фулл-хаус (3+2) — ×10</div>
                        <div>Стрит (1-5 или 2-6) — ×7</div>
                        <div>Сет (3 одинак.) — ×4</div>
                        <div>Две пары — ×2</div>
                        <div>Пара — ×1 (свои назад)</div>
                    </div>
                    <Button
                        onClick={startGame}
                        disabled={loading || !canAfford}
                        className="w-48"
                    >
                        {!canAfford ? 'Недостаточно серебра' : loading ? '...' : `Играть (${ENTRY_FEE} сер.)`}
                    </Button>
                    <BackButton />
                </div>
            )}

            {game && (
                <div className="flex flex-col items-center gap-4 mt-4">
                    <div className="text-xs text-[var(--color-text-secondary)]">
                        Перебросов: {game.rerollsUsed}/{MAX_REROLLS}
                    </div>

                    {/* Dice */}
                    <div className="flex gap-3 justify-center flex-wrap">
                        {game.dice.map((d, i) => (
                            <button
                                key={i}
                                onClick={() => toggleKeep(i)}
                                disabled={game.rerollsUsed >= MAX_REROLLS}
                                className={`w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-4xl sm:text-5xl rounded-lg border-2 transition-all ${
                                    keep.has(i)
                                        ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-primary)]/10 scale-110'
                                        : 'border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]'
                                } ${game.rerollsUsed >= MAX_REROLLS ? 'cursor-default' : 'cursor-pointer hover:border-[var(--color-accent-primary)]/50'}`}
                            >
                                {DICE_FACES[d]}
                            </button>
                        ))}
                    </div>

                    <div className="text-xs text-[var(--color-text-secondary)]">
                        {game.rerollsUsed >= MAX_REROLLS
                            ? 'Нажми «Готово» чтобы получить выигрыш'
                            : 'Нажми на кубики чтобы оставить, затем «Бросить»'}
                    </div>

                    <div className="flex gap-3">
                        {game.rerollsUsed < MAX_REROLLS && (
                            <Button onClick={reroll} disabled={loading}>
                                {loading ? '...' : 'Бросить'}
                            </Button>
                        )}
                        <Button
                            onClick={finish}
                            disabled={loading}
                            variant="secondary"
                        >
                            {loading ? '...' : 'Готово'}
                        </Button>
                    </div>

                    <BackButton />
                </div>
            )}

            {result && (
                <div className="flex flex-col items-center gap-4 mt-4">
                    {/* Result dice */}
                    <div className="flex gap-3 justify-center">
                        {result.dice.map((d, i) => (
                            <div
                                key={i}
                                className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center text-4xl sm:text-5xl rounded-lg border-2 border-[var(--color-border-light)] bg-[var(--color-bg-secondary)]"
                            >
                                {DICE_FACES[d]}
                            </div>
                        ))}
                    </div>

                    <div className="text-xl font-bold">
                        {result.comboName}
                    </div>

                    <div className={`text-lg font-bold ${result.profit >= 0 ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>
                        {result.payout > 0
                            ? `+${formatMoney(result.payout)} сер.`
                            : '0 сер.'}
                    </div>

                    <div className="text-xs text-[var(--color-text-secondary)]">
                        {result.profit > 0 ? `(прибыль: +${result.profit} сер.)` : result.profit < 0 ? `(убыток: ${result.profit} сер.)` : '(свои назад)'}
                    </div>

                    <Button onClick={startGame} disabled={loading || !canAfford}>
                        {!canAfford ? 'Недостаточно серебра' : loading ? '...' : `Ещё раз (${ENTRY_FEE} сер.)`}
                    </Button>
                    <BackButton />
                </div>
            )}
        </div>
    );
}
