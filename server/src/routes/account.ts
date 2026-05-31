import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../database';
import { changeUsernameSchema, changePasswordSchema } from '../validation';

const router = Router();

router.post('/account/change-username', (req: any, res) => {
    const parsed = changeUsernameSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректное имя' });

    const userId = req.userId;
    const { newUsername } = parsed.data;

    const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(newUsername, userId);
    if (existing) return res.status(400).json({ error: 'Это имя уже занято' });

    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, userId);
    res.json({ success: true, newUsername });
});

router.post('/account/change-gender', (req: any, res) => {
    const userId = req.userId;
    const { gender } = req.body;
    if (!['male', 'female'].includes(gender)) return res.status(400).json({ error: 'Некорректный пол' });
    db.prepare('UPDATE users SET gender = ? WHERE id = ?').run(gender, userId);
    res.json({ success: true, gender });
});

router.post('/account/change-password', (req: any, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Некорректные данные' });

    const userId = req.userId;
    const { oldPassword, newPassword } = parsed.data;

    const user = db.prepare('SELECT passwordHash FROM users WHERE id = ?').get(userId) as any;
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    if (!bcrypt.compareSync(oldPassword, user.passwordHash)) {
        return res.status(400).json({ error: 'Неверный старый пароль' });
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(passwordHash, userId);
    res.json({ success: true });
});

export default router;