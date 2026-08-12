"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const index_1 = require("../db/index");
const router = (0, express_1.Router)();
// Проверить, есть ли хоть один администратор (в таблице admins)
router.get('/admin/check', async (req, res) => {
    const admin = await index_1.db.one('SELECT id FROM admins LIMIT 1', []);
    res.json({ exists: !!admin });
});
// Зарегистрировать первого администратора (только если таблица admins пуста)
router.post('/admin/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Требуются логин и пароль' });
    // Проверяем, что администраторов ещё нет
    const existingAdmin = await index_1.db.one('SELECT id FROM admins LIMIT 1', []);
    if (existingAdmin)
        return res.status(400).json({ error: 'Администратор уже существует' });
    const passwordHash = bcryptjs_1.default.hashSync(password, 10);
    await index_1.db.run('INSERT INTO admins (username, passwordHash) VALUES (?, ?)', [username, passwordHash]);
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=adminAuth.js.map