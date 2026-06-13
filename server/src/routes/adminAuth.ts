import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database';

const router = Router();

// Проверить, есть ли хоть один администратор (в таблице admins)
router.get('/admin/check', (req, res) => {
    const admin = db.prepare('SELECT id FROM admins LIMIT 1').get();
    res.json({ exists: !!admin });
});

// Зарегистрировать первого администратора (только если таблица admins пуста)
router.post('/admin/register', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Требуются логин и пароль' });

    // Проверяем, что администраторов ещё нет
    const existingAdmin = db.prepare('SELECT id FROM admins LIMIT 1').get();
    if (existingAdmin) return res.status(400).json({ error: 'Администратор уже существует' });

    const passwordHash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admins (username, passwordHash) VALUES (?, ?)').run(username, passwordHash);

    res.json({ success: true });
});

export default router;