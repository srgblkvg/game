"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../database"));
const router = (0, express_1.Router)();
// Проверить, есть ли хоть один администратор (в таблице admins)
router.get('/admin/check', (req, res) => {
    const admin = database_1.default.prepare('SELECT id FROM admins LIMIT 1').get();
    res.json({ exists: !!admin });
});
// Зарегистрировать первого администратора (только если таблица admins пуста)
router.post('/admin/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Требуются логин и пароль' });
    // Проверяем, что администраторов ещё нет
    const existingAdmin = database_1.default.prepare('SELECT id FROM admins LIMIT 1').get();
    if (existingAdmin)
        return res.status(400).json({ error: 'Администратор уже существует' });
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    database_1.default.prepare('INSERT INTO admins (username, passwordHash) VALUES (?, ?)').run(username, passwordHash);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=adminAuth.js.map