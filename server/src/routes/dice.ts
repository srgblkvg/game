import { Router } from 'express';
import { db } from '../db/index';
import { collectGuildTax } from '../db/helpers';

const router = Router();


// Комбинации (от высшей к низшей)
type ComboName = 'poker' | 'quads' | 'fullhouse' | 'straight' | 'set' | 'twopair' | 'pair' | 'none';

const PAYOUTS: Record<ComboName, { name: string; mult: number }> = {
    poker:     { name: 'Покер',       mult: 50 },
    quads:     { name: 'Каре',        mult: 20 },
    fullhouse: { name: 'Фулл-хаус',   mult: 10 },
    straight:  { name: 'Стрит',       mult: 7 },
    set:       { name: 'Сет',         mult: 4 },
    twopair:   { name: 'Две пары',    mult: 2 },
    pair:      { name: 'Пара',        mult: 1 },
    none:      { name: 'Ничего',      mult: 0 },
};

function rollDice(): number[] {
    return Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
}

function getCombo(dice: number[]): ComboName {
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
    const userId = req.userId;
    const { bet: betRaw } = req.body as { bet?: number };
    const bet = ([10, 100, 1000].includes(betRaw!) ? betRaw! : 10);

    // Проверить, нет ли уже активной игры
    const active = await db.one(
        "SELECT id, entry_fee, created_at FROM dice_games WHERE user_id = ? AND status = 'active'",
        [userId]
    ).catch(() => null);
    if (active) {
        // Если игра старше 5 минут — авто-завершить как брошенную
        const age = Date.now() - new Date(active.created_at).getTime();
        if (age > 5 * 60 * 1000) {
            await db.run("UPDATE dice_games SET status = 'expired', combo = 'none', payout = 0 WHERE id = ?", [active.id]);
        } else {
            return res.status(400).json({ error: 'У вас уже есть активная игра' });
        }
    }

    // Проверить баланс
    const user = await db.one('SELECT money FROM users WHERE id = ?', [userId]) as any;
    if (user.money < bet) {
        return res.status(400).json({ error: 'Недостаточно серебра' });
    }

    // Снять плату
    await db.run('UPDATE users SET money = money - ? WHERE id = ?', [bet, userId]);

    // Налог гильдии
    await collectGuildTax(userId, bet, 'tax_dice').catch(() => {});

    // Бросить кости
    const dice = rollDice();
    const result = await db.run(
        "INSERT INTO dice_games (user_id, entry_fee, dice, rerolls, status) VALUES (?, ?, ?, 0, 'active')",
        [userId, bet, JSON.stringify(dice)]
    );
    const gameId = result.lastInsertRowid;

    res.json({ gameId, dice, rerollsUsed: 0, maxRerolls: 2, entryFee: bet });
});

// Перебросить выбранные кости
router.post('/dice/reroll', async (req, res) => {
    const userId = req.userId;
    const { gameId, keep } = req.body as { gameId: number; keep: number[] };

    const game = await db.one(
        "SELECT * FROM dice_games WHERE id = ? AND user_id = ? AND status = 'active'",
        [gameId, userId]
    ).catch(() => null) as any;

    if (!game) return res.status(404).json({ error: 'Игра не найдена' });
    if (game.rerolls >= 2) return res.status(400).json({ error: 'Все перебросы использованы' });

    const currentDice: number[] = JSON.parse(game.dice);
    if (!keep || !Array.isArray(keep) || keep.some((i: number) => i < 0 || i >= 5)) {
        return res.status(400).json({ error: 'Некорректный выбор костей (keep: индексы 0-4)' });
    }

    const keepSet = new Set(keep);
    const newDice = currentDice.map((d, i) => keepSet.has(i) ? d : Math.floor(Math.random() * 6) + 1);

    await db.run(
        "UPDATE dice_games SET dice = ?, rerolls = rerolls + 1 WHERE id = ?",
        [JSON.stringify(newDice), gameId]
    );

    res.json({ dice: newDice, rerollsUsed: game.rerolls + 1, maxRerolls: 2 });
});

// Завершить игру и получить выигрыш
router.post('/dice/finish', async (req, res) => {
    const userId = req.userId;
    const { gameId } = req.body as { gameId: number };

    const game = await db.one(
        "SELECT * FROM dice_games WHERE id = ? AND user_id = ? AND status = 'active'",
        [gameId, userId]
    ).catch(() => null) as any;

    if (!game) return res.status(404).json({ error: 'Игра не найдена' });

    const dice: number[] = JSON.parse(game.dice);
    const combo = getCombo(dice);
    const payout = PAYOUTS[combo];
    const winAmount = payout.mult * game.entry_fee;

    if (winAmount > 0) {
        await db.run('UPDATE users SET money = money + ? WHERE id = ?', [winAmount, userId]);
    }
    // Общая статистика казино (кости + блэкджек)
    await db.run(
        'UPDATE users SET casino_games_played = casino_games_played + 1, casino_won = casino_won + ?, casino_lost = casino_lost + ? WHERE id = ?',
        [winAmount, game.entry_fee, userId]
    );
    await db.run("UPDATE dice_games SET status = 'finished', combo = ?, payout = ? WHERE id = ?",
        [combo, winAmount, gameId]);

    res.json({
        dice,
        combo,
        comboName: payout.name,
        payout: winAmount,
        profit: winAmount - game.entry_fee,
    });
});

// Получить историю игр
router.get('/dice/history', async (req, res) => {
    const userId = req.userId;
    const history = await db.query(
        "SELECT dice, combo, payout, entry_fee, created_at FROM dice_games WHERE user_id = ? AND status = 'finished' ORDER BY id DESC LIMIT 20",
        [userId]
    );
    res.json(history);
});

export default router;
