import { Router } from 'express';
import { db } from '../db/index';
import { collectGuildTax } from '../db/helpers';
import { createPgDiceFinishRepository, finishDiceGame } from '../game/diceFinishRepository';
import { DiceGameNotActiveError } from '../game/diceFinish';

const diceFinishRepository = createPgDiceFinishRepository();

const router = Router();
const DAILY_LIMIT = 10;

// Посчитать сегодняшние игры
async function countTodayGames(userId: number): Promise<number> {
    const row = await db.one(
        "SELECT COUNT(*) as cnt FROM dice_games WHERE user_id = ? AND created_at::date = CURRENT_DATE",
        [userId]
    ) as any;
    return row.cnt || 0;
}

// Статус: активная игра + дневной лимит
router.get('/dice/status', async (req, res) => {
    const userId = (req as any).userId;
    const active = await db.one(
        "SELECT id, entry_fee, dice, rerolls, created_at FROM dice_games WHERE user_id = ? AND status = 'active'",
        [userId]
    ).catch(() => null) as any;

    const todayCount = await countTodayGames(userId);
    const remaining = Math.max(0, DAILY_LIMIT - todayCount);

    if (active) {
        res.json({
            activeGame: {
                gameId: active.id,
                dice: JSON.parse(active.dice || '[]'),
                rerollsUsed: active.rerolls,
                maxRerolls: 2,
                entryFee: active.entry_fee,
            },
            todayGames: todayCount,
            dailyLimit: DAILY_LIMIT,
            remaining,
        });
    } else {
        res.json({ activeGame: null, todayGames: todayCount, dailyLimit: DAILY_LIMIT, remaining });
    }
});

// Таблица выплат (казино — пара и две пары = проигрыш)
const PAYOUTS: Record<string, { name: string; mult: number }> = {
    poker: { name: 'Покер', mult: 100 },
    quads: { name: 'Каре', mult: 25 },
    fullhouse: { name: 'Фулл-хаус', mult: 8 },
    straight: { name: 'Стрит', mult: 5 },
    set: { name: 'Сет', mult: 3 },
    twopair: { name: 'Две пары', mult: 0 },
    pair: { name: 'Пара', mult: 0 },
    none: { name: 'Ничего', mult: 0 },
};

function rollDice(): number[] {
    return Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
}

function getCombo(dice: number[]): string {
    const counts = new Map<number, number>();
    for (const d of dice) counts.set(d, (counts.get(d) || 0) + 1);
    const vals = [...counts.values()].sort((a, b) => b - a);
    const sorted = [...dice].sort((a, b) => a - b);
    const isStraight = (
        (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 3 && sorted[3] === 4 && sorted[4] === 5) ||
        (sorted[0] === 2 && sorted[1] === 3 && sorted[2] === 4 && sorted[3] === 5 && sorted[4] === 6)
    );

    if (vals[0] === 5) return 'poker';
    if (vals[0] === 4) return 'quads';
    if (vals[0] === 3 && vals[1] === 2) return 'fullhouse';
    if (isStraight) return 'straight';
    if (vals[0] === 3) return 'set';
    if (vals[0] === 2 && vals[1] === 2) return 'twopair';
    if (vals[0] === 2) return 'pair';
    return 'none';
}

// Начать игру
router.post('/dice/play', async (req, res) => {
    const userId = (req as any).userId;
    const bet = [10, 100, 1000].includes(req.body.bet) ? req.body.bet : 10;

    // Дневной лимит
    const todayCount = await countTodayGames(userId);
    if (todayCount >= DAILY_LIMIT)
        return res.status(400).json({ error: `Дневной лимит исчерпан (${todayCount}/${DAILY_LIMIT})` });

    // Проверить активную игру
    const active = await db.one(
        "SELECT id, entry_fee, created_at FROM dice_games WHERE user_id = ? AND status = 'active'",
        [userId]
    ).catch(() => null) as any;

    if (active) {
        const age = Date.now() - new Date(active.created_at).getTime();
        if (age > 5 * 60 * 1000) {
            await db.run("UPDATE dice_games SET status = 'expired', combo = 'none', payout = 0 WHERE id = ?", [active.id]);
        } else {
            return res.status(400).json({ error: 'У вас уже есть активная игра' });
        }
    }

    // Баланс
    const user = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;
    if (user.money < bet) return res.status(400).json({ error: 'Недостаточно серебра' });

    // Снять плату
    await db.run('UPDATE users SET money = money - ? WHERE id = ?', [bet, userId]);
    await collectGuildTax(userId, bet, 'tax_dice').catch(() => {});

    // Бросить кости
    const dice = rollDice();
    const result = await db.run(
        "INSERT INTO dice_games (user_id, entry_fee, dice, rerolls, status) VALUES (?, ?, ?, 0, 'active')",
        [userId, bet, JSON.stringify(dice)]
    );
    const gameId = (result as any).lastInsertRowid;

    res.json({ gameId, dice, rerollsUsed: 0, maxRerolls: 2, entryFee: bet });
});

// Перебросить
router.post('/dice/reroll', async (req, res) => {
    const userId = (req as any).userId;
    const { gameId, keep } = req.body;

    const game = await db.one(
        "SELECT * FROM dice_games WHERE id = ? AND user_id = ? AND status = 'active'",
        [gameId, userId]
    ).catch(() => null) as any;

    if (!game) return res.status(404).json({ error: 'Игра не найдена' });
    if (game.rerolls >= 2) return res.status(400).json({ error: 'Все перебросы использованы' });

    const currentDice: number[] = JSON.parse(game.dice);
    if (!keep || !Array.isArray(keep) || keep.some((i: number) => i < 0 || i >= 5)) {
        return res.status(400).json({ error: 'Некорректный выбор костей' });
    }

    const keepSet = new Set(keep);
    const newDice = currentDice.map((d, i) => keepSet.has(i) ? d : Math.floor(Math.random() * 6) + 1);

    await db.run("UPDATE dice_games SET dice = ?, rerolls = rerolls + 1 WHERE id = ?", [JSON.stringify(newDice), gameId]);
    res.json({ dice: newDice, rerollsUsed: game.rerolls + 1, maxRerolls: 2 });
});

// Завершить игру
router.post('/dice/finish', async (req, res) => {
    const userId = (req as any).userId;
    const { gameId } = req.body;
    try {
        const result = await finishDiceGame(diceFinishRepository, { userId, gameId: Number(gameId) });
        res.json(result);
    } catch (error) {
        if (error instanceof DiceGameNotActiveError || (error as Error).message === 'Игра не найдена') {
            return res.status(404).json({ error: 'Игра не найдена' });
        }
        throw error;
    }
});

// История игр
router.get('/dice/history', async (req, res) => {
    const userId = (req as any).userId;
    const history = await db.query(
        "SELECT dice, combo, payout, entry_fee, created_at FROM dice_games WHERE user_id = ? AND status = 'finished' ORDER BY id DESC LIMIT 20",
        [userId]
    ) as any[];
    res.json(history);
});

export default router;
