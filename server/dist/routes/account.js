"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../database"));
const validation_1 = require("../validation");
const router = (0, express_1.Router)();
router.post('/account/change-username', (req, res) => {
    const parsed = validation_1.changeUsernameSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректное имя' });
    const userId = req.userId;
    const { newUsername } = parsed.data;
    const existing = database_1.default.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, userId);
    if (existing)
        return res.status(400).json({ error: 'Это имя уже занято' });
    database_1.default.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, userId);
    res.json({ success: true, newUsername });
});
router.post('/account/change-gender', (req, res) => {
    const userId = req.userId;
    const { gender } = req.body;
    if (!['male', 'female'].includes(gender))
        return res.status(400).json({ error: 'Некорректный пол' });
    database_1.default.prepare('UPDATE users SET gender = ? WHERE id = ?').run(gender, userId);
    res.json({ success: true, gender });
});
router.post('/account/change-password', (req, res) => {
    const parsed = validation_1.changePasswordSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Некорректные данные' });
    const userId = req.userId;
    const { oldPassword, newPassword } = parsed.data;
    const user = database_1.default.prepare('SELECT passwordHash FROM users WHERE id = ?').get(userId);
    if (!user)
        return res.status(404).json({ error: 'Пользователь не найден' });
    if (!bcryptjs_1.default.compareSync(oldPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Неверный старый пароль' });
    }
    const passwordHash = bcryptjs_1.default.hashSync(newPassword, 10);
    database_1.default.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(passwordHash, userId);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=account.js.map