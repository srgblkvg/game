"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_1 = require("../db/index");
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
// ---------- Загрузка изображений ----------
const ADMIN_UPLOADS_DIR = path_1.default.resolve(__dirname, '../../uploads/admin');
fs_1.default.mkdirSync(ADMIN_UPLOADS_DIR, { recursive: true });
router.post('/upload-image', async (req, res) => {
    const { image, folder } = req.body; // image: data:image/...;base64,...
    if (!image || typeof image !== 'string')
        return res.status(400).json({ error: 'Нет изображения' });
    const match = image.match(/^data:image\/(webp|png|jpeg|jpg);base64,(.+)$/);
    if (!match)
        return res.status(400).json({ error: 'Неверный формат (нужен base64 image)' });
    const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const subfolder = folder ? `${folder}/` : '';
    const dir = path_1.default.join(ADMIN_UPLOADS_DIR, subfolder);
    fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(path_1.default.join(dir, filename), Buffer.from(match[2], 'base64'));
    const url = `/uploads/admin/${subfolder}${filename}`;
    res.json({ success: true, url });
});
// Массовая загрузка по существующим путям (без переименования)
router.post('/upload-bulk', async (req, res) => {
    const { images } = req.body; // [{ targetPath: '/uploads/admin/floors/x.webp', dataUrl: 'data:...' }]
    if (!Array.isArray(images))
        return res.status(400).json({ error: 'images must be array' });
    const results = [];
    for (const img of images) {
        try {
            const { targetPath, dataUrl } = img;
            if (!targetPath || !dataUrl) {
                results.push({ targetPath, success: false, error: 'missing fields' });
                continue;
            }
            const match = dataUrl.match(/^data:image\/(webp|png|jpeg|jpg);base64,(.+)$/);
            if (!match) {
                results.push({ targetPath, success: false, error: 'bad format' });
                continue;
            }
            const relPath = targetPath.replace(/^\/uploads\/admin\//, '');
            const fullPath = path_1.default.join(ADMIN_UPLOADS_DIR, relPath);
            const dir = path_1.default.dirname(fullPath);
            fs_1.default.mkdirSync(dir, { recursive: true });
            fs_1.default.writeFileSync(fullPath, Buffer.from(match[2], 'base64'));
            results.push({ targetPath, success: true });
        }
        catch (e) {
            results.push({ targetPath: img.targetPath || '', success: false, error: e.message });
        }
    }
    res.json({ results });
});
// Список загруженных изображений
router.get('/images', async (req, res) => {
    const folder = req.query.folder || '';
    const dir = path_1.default.join(ADMIN_UPLOADS_DIR, folder);
    if (!fs_1.default.existsSync(dir))
        return res.json([]);
    const files = fs_1.default.readdirSync(dir)
        .filter(f => /\.(webp|png|jpg|jpeg)$/i.test(f))
        .map(f => `/uploads/admin/${folder ? folder + '/' : ''}${f}`)
        .sort().reverse();
    res.json(files);
});
// ---------- Предметы ----------
router.get('/items', async (req, res) => {
    const items = await index_1.db.query(`
        SELECT i.*, r.name as rarity_name, r.display_name as rarity_display, r.color as rarity_color
        FROM items i
        JOIN rarities r ON i.rarity_id = r.id
        ORDER BY i.id DESC
    `, []);
    res.json(items);
});
router.post('/items', async (req, res) => {
    const parsed = validation_1.createItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });
    const { name, slot, rarity_id, bonuses, extra, image, cost } = parsed.data;
    await index_1.db.run('INSERT INTO items (name, slot, rarity_id, bonuses, extra, image, cost) VALUES (?, ?, ?, ?, ?, ?, ?)', [name, slot, rarity_id, JSON.stringify(bonuses || {}), JSON.stringify(extra || {}), image || null, cost ?? null]);
    res.json({ success: true });
});
router.put('/items/:id', async (req, res) => {
    const parsed = validation_1.createItemSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные предмета', issues: parsed.error.issues });
    const { name, slot, rarity_id, bonuses, extra, image, cost } = parsed.data;
    await index_1.db.run('UPDATE items SET name=?, slot=?, rarity_id=?, bonuses=?, extra=?, image=?, cost=? WHERE id=?', [name, slot, rarity_id, JSON.stringify(bonuses || {}), JSON.stringify(extra || {}), image || null, cost ?? null, req.params.id]);
    res.json({ success: true });
});
router.delete('/items/:id', async (req, res) => {
    await index_1.db.run('DELETE FROM items WHERE id = ?', [req.params.id]);
    res.json({ success: true });
});
// ---------- Игроки ----------
router.get('/users', async (req, res) => {
    const filter = req.query.filter || 'all'; // all | guests | players
    let query = `
        SELECT id, username, level, money, totalBattles, wins,
               lastAttackTime, protectionUntil, activeJob, inventorySlots,
               email, emailVerified, oauthProvider, createdAt, bannedUntil, lastLoginAt, premiumUntil, isGuest
        FROM users`;
    if (filter === 'guests')
        query += ' WHERE isGuest = 1';
    else if (filter === 'players')
        query += ' WHERE isGuest = 0';
    query += ' ORDER BY lastLoginAt DESC NULLS LAST';
    const users = await index_1.db.query(query, []);
    res.json(users);
});
// Бан игрока
router.post('/ban-user', async (req, res) => {
    const { userId, duration, unit } = req.body;
    if (!userId || !duration)
        return res.status(400).json({ error: 'Требуются userId и duration' });
    const multipliers = { minutes: 60, hours: 3600, days: 86400 };
    const multiplier = multipliers[unit] || 3600;
    const seconds = duration * multiplier;
    const bannedUntil = Math.floor(Date.now() / 1000) + seconds;
    const user = await index_1.db.one('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Игрок не найден' });
    await index_1.db.run('UPDATE users SET bannedUntil = ? WHERE id = ?', [bannedUntil, userId]);
    res.json({ success: true, bannedUntil, message: `${user.username} забанен на ${duration} ${unit}` });
});
// Разбан игрока
router.post('/unban-user', async (req, res) => {
    const { userId } = req.body;
    if (!userId)
        return res.status(400).json({ error: 'Требуется userId' });
    await index_1.db.run('UPDATE users SET bannedUntil = 0 WHERE id = ?', [userId]);
    res.json({ success: true, message: 'Игрок разбанен' });
});
// Удаление игрока
router.delete('/users/:id', async (req, res) => {
    const userId = parseInt(req.params.id);
    const user = await index_1.db.one('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Игрок не найден' });
    // Каскадное удаление
    await index_1.db.run('DELETE FROM battles WHERE attackerId = ? OR defenderId = ?', [userId, userId]);
    await index_1.db.run('DELETE FROM job_history WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM chat_messages WHERE senderId = ?', [userId]);
    await index_1.db.run('DELETE FROM login_logs WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM auction_lots WHERE sellerId = ?', [userId]);
    await index_1.db.run('DELETE FROM tournament_participants WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM order_members WHERE userId = ?', [userId]);
    await index_1.db.run('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: `Игрок ${user.username} (ID ${userId}) удалён` });
});
// IP-адреса игрока
router.get('/users/:id/ips', async (req, res) => {
    const userId = parseInt(req.params.id);
    const ips = await index_1.db.query('SELECT ip, MAX(createdAt) as lastSeen, COUNT(*) as count FROM login_logs WHERE userId = ? GROUP BY ip ORDER BY lastSeen DESC', [userId]);
    res.json(ips);
});
router.post('/add-money', async (req, res) => {
    const parsed = validation_1.addMoneySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { userId, amount } = parsed.data;
    const user = await index_1.db.one('SELECT id, money FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    const newMoney = user.money + amount;
    await index_1.db.run('UPDATE users SET money = ? WHERE id = ?', [newMoney, userId]);
    res.json({ success: true, newMoney });
});
router.post('/reset-timers', async (req, res) => {
    const parsed = validation_1.resetTimersSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { all, userId } = parsed.data;
    if (all) {
        await index_1.db.run('UPDATE users SET lastAttackTime = 0, protectionUntil = 0', []);
        return res.json({ success: true });
    }
    if (!userId)
        return res.status(400).json({ error: 'userId required' });
    await index_1.db.run('UPDATE users SET lastAttackTime = 0, protectionUntil = 0 WHERE id = ?', [userId]);
    res.json({ success: true });
});
// Получить список редкостей
router.get('/rarities', async (req, res) => {
    const rarities = await index_1.db.query('SELECT * FROM rarities ORDER BY id', []);
    res.json(rarities);
});
// Смена пароля администратора
router.post('/change-password', async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword)
        return res.status(400).json({ error: 'Требуются старый и новый пароль' });
    if (newPassword.length < 8)
        return res.status(400).json({ error: 'Новый пароль должен быть минимум 8 символов' });
    const admin = await index_1.db.one('SELECT passwordHash FROM admins WHERE id = ?', [req.adminId]);
    if (!admin)
        return res.status(404).json({ error: 'Администратор не найден' });
    if (!bcryptjs_1.default.compareSync(oldPassword, admin.passwordHash)) {
        return res.status(400).json({ error: 'Неверный старый пароль' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(newPassword, 10);
    await index_1.db.run('UPDATE admins SET passwordHash = ? WHERE id = ?', [passwordHash, req.adminId]);
    res.json({ success: true });
});
// Выдача премиума
router.post('/premium', async (req, res) => {
    const { userId, days } = req.body;
    if (!userId || !days || days < 1)
        return res.status(400).json({ error: 'Требуются userId и days (>= 1)' });
    const user = await index_1.db.one('SELECT id, username, premiumUntil FROM users WHERE id = ?', [userId]);
    if (!user)
        return res.status(404).json({ error: 'Игрок не найден' });
    const now = Math.floor(Date.now() / 1000);
    const currentUntil = Math.max(user.premiumUntil || 0, now);
    const newUntil = currentUntil + days * 86400;
    await index_1.db.run('UPDATE users SET premiumUntil = ? WHERE id = ?', [newUntil, userId]);
    const untilDate = new Date(newUntil * 1000).toLocaleDateString('ru-RU');
    res.json({ success: true, premiumUntil: newUntil, message: `${user.username}: премиум до ${untilDate} (${days} дн.)` });
});
// GET /api/admin/donate/history — история донат-платежей
router.get('/donate/history', async (_req, res) => {
    try {
        const vk = await index_1.db.query(`
      SELECT vp.id, 'vk' as platform, vp.item, vp.status, '' as amount,
             u.username, u.id as user_id, vp.created_at
      FROM vk_payments vp
      LEFT JOIN users u ON vp.character_id = u.id
      ORDER BY vp.created_at DESC LIMIT 100
    `, []);
        const yk = await index_1.db.query(`
      SELECT yp.id, 'yukassa' as platform, COALESCE(yp.item, 'premium') as item, yp.status, yp.amount,
             u.username, u.id as user_id, yp.created_at
      FROM yukassa_payments yp
      LEFT JOIN users u ON yp.user_id = u.id
      ORDER BY yp.created_at DESC LIMIT 100
    `, []);
        const all = [...vk, ...yk]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 200);
        res.json(all);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map