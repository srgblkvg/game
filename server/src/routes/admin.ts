import { Router } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import db from '../database';
import { createItemSchema, addMoneySchema, resetTimersSchema } from '../validation';

const router = Router();

// ---------- Загрузка изображений ----------
const ADMIN_UPLOADS_DIR = path.resolve(__dirname, '../../uploads/admin');
fs.mkdirSync(ADMIN_UPLOADS_DIR, { recursive: true });

router.post('/upload-image', async (req, res) => {
    const { image, folder } = req.body; // image: data:image/...;base64,...
    if (!image || typeof image !== 'string') return res.status(400).json({ error: 'Нет изображения' });

    const match = image.match(/^data:image\/(webp|png|jpeg|jpg);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: 'Неверный формат (нужен base64 image)' });

    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
    const subfolder = folder ? `${folder}/` : '';
    const dir = path.join(ADMIN_UPLOADS_DIR, subfolder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, filename), Buffer.from(match[2], 'base64'));

    const url = `/uploads/admin/${subfolder}${filename}`;
    res.json({ success: true, url });
});

// Список загруженных изображений
router.get('/images', async (req, res) => {
    const folder = (req.query.folder as string) || '';
    const dir = path.join(ADMIN_UPLOADS_DIR, folder);
    if (!fs.existsSync(dir)) return res.json([]);
    const files = fs.readdirSync(dir)
        .filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f))
        .map(f => `/uploads/admin/${folder ? folder + '/' : ''}${f}`)
        .sort().reverse();
    res.json(files);
});

// ---------- Предметы ----------
router.get('/items', async (req, res) => {
    const items = await db.manyOrNone(`
        SELECT i.*, r.name as rarity_name, r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        ORDER BY i.id DESC
    `);
    res.json(items);
});

router.post('/items', async (req, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });

    const { name, slot, rarity_id, bonuses, extra, image, cost } = parsed.data;
    await db.none('INSERT INTO items (name, slot, rarity_id, bonuses, extra, image, cost) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, slot, rarity_id, JSON.stringify(bonuses || {}]), JSON.stringify(extra || {}), image || null, cost ?? null);
    res.json({ success: true });
});

router.put('/items/:id', async (req, res) => {
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });

    const { name, slot, rarity_id, bonuses, extra, image, cost } = parsed.data;
    await db.none('UPDATE items SET name=?, slot=?, rarity_id=?, bonuses=?, extra=?, image=?, cost=? WHERE id=?', [name, slot, rarity_id, JSON.stringify(bonuses || {}]), JSON.stringify(extra || {}), image || null, cost ?? null, req.params.id);
    res.json({ success: true });
});

router.delete('/items/:id', async (req, res) => {
    await db.none('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});

// ---------- Игроки ----------
router.get('/users', async (req, res) => {
    const filter = req.query.filter as string || 'all'; // all | guests | players
    let query = `
        SELECT id, username, level, money, totalBattles, wins,
               lastAttackTime, protectionUntil, activeJob, inventorySlots,
               email, emailVerified, oauthProvider, createdAt, bannedUntil, lastLoginAt, premiumUntil, isGuest
        FROM users`;
    if (filter === 'guests') query += ' WHERE isGuest = 1';
    else if (filter === 'players') query += ' WHERE isGuest = 0';
    query += ' ORDER BY lastLoginAt DESC NULLS LAST';
    const users = await db.prepare(query).all();
    res.json(users);
});

// Бан игрока
router.post('/ban-user', async (req, res) => {
    const { userId, duration, unit } = req.body;
    if (!userId || !duration) return res.status(400).json({ error: 'Требуются userId и duration' });

    const multipliers: Record<string, number> = { minutes: 60, hours: 3600, days: 86400 };
    const multiplier = multipliers[unit] || 3600;
    const seconds = duration * multiplier;
    const bannedUntil = Math.floor(Date.now() / 1000) + seconds;

    const user = await db.oneOrNone('SELECT id, username FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });

    await db.none('UPDATE users SET bannedUntil = ? WHERE id = ?', [bannedUntil, userId]);
    res.json({ success: true, bannedUntil, message: `${user.username} забанен на ${duration} ${unit}` });
});

// Разбан игрока
router.post('/unban-user', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Требуется userId' });

    await db.none('UPDATE users SET bannedUntil = 0 WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Игрок разбанен' });
});

// Удаление игрока
router.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    const user = await db.oneOrNone('SELECT id, username FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });

    // Каскадное удаление
    await db.none('DELETE FROM battles WHERE attackerId = ? OR defenderId = ?', [userId, userId]);
    await db.none('DELETE FROM job_history WHERE userId = ?', [userId]);
    await db.none('DELETE FROM chat_messages WHERE senderId = ?', [userId]);
    await db.none('DELETE FROM login_logs WHERE userId = ?', [userId]);
    await db.none('DELETE FROM auction_lots WHERE sellerId = ?', [userId]);
    await db.none('DELETE FROM tournament_participants WHERE userId = ?', [userId]);
    await db.none('DELETE FROM order_members WHERE userId = ?', [userId]);
    await db.none('DELETE FROM users WHERE id = ?', [userId]);

    res.json({ success: true, message: `Игрок ${user.username} (ID ${userId}) удалён` });
});

// IP-адреса игрока
router.get('/users/:id/ips', async (req, res) => {
    const userId = parseInt(req.params.id);
    const ips = db.prepare(
        'SELECT ip, MAX(createdAt) as lastSeen, COUNT(*) as count FROM login_logs WHERE userId = ? GROUP BY ip ORDER BY lastSeen DESC'
    ).all(userId);
    res.json(ips);
});

router.post('/add-money', async (req, res) => {
    const parsed = addMoneySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { userId, amount } = parsed.data;
    const user = await db.oneOrNone('SELECT id, money FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'User not found' });
    const newMoney = user.money + amount;
    await db.none('UPDATE users SET money = ? WHERE id = ?', [newMoney, userId]);
    res.json({ success: true, newMoney });
});

router.post('/reset-timers', async (req, res) => {
    const parsed = resetTimersSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const { all, userId } = parsed.data;
    if (all) {
        await db.none('UPDATE users SET lastAttackTime = 0, protectionUntil = 0');
        return res.json({ success: true });
    }
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await db.none('UPDATE users SET lastAttackTime = 0, protectionUntil = 0 WHERE id = ?', [userId]);
    res.json({ success: true });
});

// Получить список редкостей
router.get('/rarities', async (req, res) => {
    const rarities = await db.manyOrNone('SELECT * FROM rarities ORDER BY id');
    res.json(rarities);
});

// Смена пароля администратора
router.post('/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Требуются старый и новый пароль' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Новый пароль должен быть минимум 8 символов' });

    const admin = await db.oneOrNone('SELECT passwordHash FROM admins WHERE id = ?', [req.adminId]) as any;
    if (!admin) return res.status(404).json({ error: 'Администратор не найден' });

    if (!bcrypt.compareSync(oldPassword, admin.passwordHash)) {
        return res.status(400).json({ error: 'Неверный старый пароль' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await db.none('UPDATE admins SET passwordHash = ? WHERE id = ?', [passwordHash, req.adminId]);
    res.json({ success: true });
});

// Выдача премиума
router.post('/premium', async (req, res) => {
    const { userId, days } = req.body;
    if (!userId || !days || days < 1) return res.status(400).json({ error: 'Требуются userId и days (>= 1)' });

    const user = await db.oneOrNone('SELECT id, username, premiumUntil FROM users WHERE id = ?', [userId]) as any;
    if (!user) return res.status(404).json({ error: 'Игрок не найден' });

    const now = Math.floor(Date.now() / 1000);
    const currentUntil = Math.max(user.premiumUntil || 0, now);
    const newUntil = currentUntil + days * 86400;

    await db.none('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);
    const untilDate = new Date(newUntil * 1000).toLocaleDateString('ru-RU');

    res.json({ success: true, premiumUntil: newUntil, message: `${user.username}: премиум до ${untilDate} (${days} дн.)` });
});

export default router;