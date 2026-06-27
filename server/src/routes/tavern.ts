import { Router } from 'express';
import { db } from '../db/index';
import { buildPlayerStats } from '../db/helpers';
import { getGuildBonus } from '../game/guildBuildings';

const router = Router();

// Комнаты отдыха
const rooms: Record<string, { name: string; rate: number; cost1h: number; cost8h: number }> = {
    closet: { name: 'Чулан', rate: 3, cost1h: 100, cost8h: 600 },
    bed: { name: 'Койка', rate: 10, cost1h: 500, cost8h: 3000 },
    chamber: { name: 'Покой', rate: 50, cost1h: 2000, cost8h: 12000 },
};

// Напитки
const drinks: Record<string, { name: string; bonuses: Record<string, number>; cost: number }> = {
    rage_small: { name: 'Настойка ярости', bonuses: { s: 10 }, cost: 150 },
    rage_med: { name: 'Крепкая настойка ярости', bonuses: { s: 25 }, cost: 600 },
    rage_big: { name: 'Эликсир берсерка', bonuses: { s: 50 }, cost: 2500 },
    shadow_small: { name: 'Настойка теней', bonuses: { a: 10 }, cost: 150 },
    shadow_med: { name: 'Крепкая настойка теней', bonuses: { a: 25 }, cost: 600 },
    shadow_big: { name: 'Эликсир призрака', bonuses: { a: 50 }, cost: 2500 },
    stone_small: { name: 'Настойка камня', bonuses: { d: 10 }, cost: 150 },
    stone_med: { name: 'Крепкая настойка камня', bonuses: { d: 25 }, cost: 600 },
    stone_big: { name: 'Эликсир бастиона', bonuses: { d: 50 }, cost: 2500 },
    eye_small: { name: 'Настойка ока', bonuses: { m: 10 }, cost: 150 },
    eye_med: { name: 'Крепкая настойка ока', bonuses: { m: 25 }, cost: 600 },
    eye_big: { name: 'Эликсир пророка', bonuses: { m: 50 }, cost: 2500 },
    grog_small: { name: 'Грог Моры', bonuses: { s: 5, a: 5, d: 5, m: 5 }, cost: 400 },
    grog_med: { name: 'Крепкий грог', bonuses: { s: 12, a: 12, d: 12, m: 12 }, cost: 1800 },
    dragon_blood: { name: 'Кровь дракона', bonuses: { s: 30, a: 30, d: 30, m: 30 }, cost: 10000 },
};

// Статус трактира
router.get('/tavern', async (req, res) => {
    const userId = req.userId;
    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const guildBonus = await getGuildBonus(req.userId, 'arena');
    const stats = await buildPlayerStats(user, 'arena');
    const maxHp = stats.hp;

    res.json({
        currentHp: user.currentHp,
        maxHp,
        money: user.money,
        room: user.roomType && user.roomUntil > now ? { type: user.roomType, until: user.roomUntil } : null,
        drink: user.activeDrink && user.drinkUntil > now ? { type: user.activeDrink, until: user.drinkUntil } : null,
        rooms: Object.entries(rooms).map(([key, r]) => ({ key, ...r })),
        drinks: Object.entries(drinks).map(([key, d]) => ({ key, ...d })),
    });
});

// Мгновенное лечение
router.post('/tavern/heal', async (req, res) => {
    const userId = req.userId;
    const { full } = req.body; // full=true — полное, иначе 50%

    const user = await db.one('SELECT * FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = Math.floor(Date.now() / 1000);
    const guildBonus = await getGuildBonus(req.userId, 'arena');
    const stats = await buildPlayerStats(user, 'arena');
    const maxHp = stats.hp;
    const missingHp = maxHp - user.currentHp;
    if (missingHp <= 0) return res.status(400).json({ error: 'HP уже полное' });

    const healAmount = full ? missingHp : Math.ceil(missingHp * 0.5);
    const cost = healAmount * 2;

    if (user.money < cost) return res.status(400).json({ error: `Недостаточно монет (нужно ${cost})` });

    await db.run('UPDATE users SET money = money - ?, currentHp = ? WHERE id = ?', [cost, user.currentHp + healAmount, userId]);

    res.json({ success: true, hpAfter: user.currentHp + healAmount, cost });
});

// Аренда комнаты
router.post('/tavern/room', async (req, res) => {
    const userId = req.userId;
    const { roomType, hours } = req.body; // hours: 1 or 8

    const room = rooms[roomType];
    if (!room) return res.status(400).json({ error: 'Неизвестный тип комнаты' });

    const duration = hours === 8 ? 8 : 1;
    const cost = hours === 8 ? room.cost8h : room.cost1h;

    const user = await db.one('SELECT money, roomType, roomUntil FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < cost) return res.status(400).json({ error: `Недостаточно монет (нужно ${cost})` });

    const now = Math.floor(Date.now() / 1000);
    // Стакаем время: если та же комната уже активна — добавляем к существующему until
    let until: number;
    if (user.roomType === roomType && (user.roomUntil || 0) > now) {
        until = user.roomUntil + duration * 3600;
    } else {
        until = now + duration * 3600;
    }

    await db.run('UPDATE users SET money = money - ?, roomType = ?, roomUntil = ? WHERE id = ?',
        [cost, roomType, until, userId]);

    res.json({ success: true, room: { type: roomType, name: room.name, until, rate: room.rate } });
});

// Купить напиток
router.post('/tavern/drink', async (req, res) => {
    const userId = req.userId;
    const { drinkType } = req.body;

    const drink = drinks[drinkType];
    if (!drink) return res.status(400).json({ error: 'Неизвестный напиток' });

    const user = await db.one('SELECT money, activeDrink, drinkUntil FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.money < drink.cost) return res.status(400).json({ error: `Недостаточно монет (нужно ${drink.cost})` });

    const now = Math.floor(Date.now() / 1000);
    // Стакаем время: если тот же напиток уже активен — добавляем к существующему until
    let until: number;
    if (user.activeDrink === drinkType && (user.drinkUntil || 0) > now) {
        until = user.drinkUntil + 3600;
    } else {
        until = now + 3600;
    }

    await db.run('UPDATE users SET money = money - ?, activeDrink = ?, drinkUntil = ? WHERE id = ?',
        [drink.cost, drinkType, until, userId]);

    res.json({ success: true, drink: { type: drinkType, name: drink.name, bonuses: drink.bonuses, until } });
});

export default router;
