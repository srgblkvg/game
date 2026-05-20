"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../database"));
const validation_1 = require("../validation");
const env_1 = require("../env");
const router = (0, express_1.Router)();
router.post('/register', (req, res) => {
    const parsed = validation_1.registerSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные', details: parsed.error.flatten() });
    const { username, password } = parsed.data;
    const existing = database_1.default.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing)
        return res.status(400).json({ error: 'Пользователь уже существует' });
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    const now = Math.floor(Date.now() / 1000);
    const startHp = 5 + 5 + 100 + 5 + 5;
    const info = database_1.default.prepare('INSERT INTO users (username, passwordHash, currentHp, lastHpUpdate, level, gender) VALUES (?, ?, ?, ?, 1, \'male\')')
        .run(username, passwordHash, startHp, now);
    const userId = info.lastInsertRowid;
    const token = jsonwebtoken_1.default.sign({ userId, role: 'player' }, env_1.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: userId, username, level: 1, role: 'player' } });
});
router.post('/login', (req, res) => {
    const parsed = validation_1.loginSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const { username, password } = parsed.data;
    // Сначала ищем среди администраторов
    const admin = database_1.default.prepare('SELECT * FROM admins WHERE username = ?').get(username);
    if (admin && bcryptjs_1.default.compareSync(password, admin.passwordHash)) {
        const token = jsonwebtoken_1.default.sign({ adminId: admin.id, role: 'admin' }, env_1.JWT_SECRET, { expiresIn: '30d' });
        return res.json({ token, user: { id: admin.id, username: admin.username, level: 0, role: 'admin' } });
    }
    // Затем среди игроков
    const user = database_1.default.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcryptjs_1.default.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    const token = jsonwebtoken_1.default.sign({ userId: user.id, role: 'player' }, env_1.JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, level: user.level, role: 'player' } });
});
exports.default = router;
//# sourceMappingURL=auth.js.map