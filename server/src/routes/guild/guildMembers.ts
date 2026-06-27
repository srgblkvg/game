import { Router } from "express";
import { db } from "../../db/index";
import { broadcast } from "../../events";

const router = Router();

router.get('/guild/requests', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const requests = await db.query(`
        SELECT gi.*, u.username
        FROM guild_invites gi
        JOIN users u ON gi.userId = u.id
        WHERE gi.guildId = ? AND gi.status = 'pending' AND gi.invitedBy = 0
        ORDER BY gi.createdAt DESC
    `, [member.guildId]);
    res.json(requests);
});

// Мои приглашения
router.get('/guild/invites', async (req, res) => {
    const userId = req.userId;
    const invites = await db.query(`
        SELECT gi.*, g.name as guildName, u.username as inviterName
        FROM guild_invites gi
        JOIN guilds g ON gi.guildId = g.id
        LEFT JOIN users u ON gi.invitedBy = u.id
        WHERE gi.userId = ? AND gi.status = 'pending'
        ORDER BY gi.createdAt DESC
    `, [userId]);
    res.json(invites);
});

// --- Гильд-чат ---
router.post('/guild/join/:id', async (req, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.id);

    const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

    const guild = await db.one('SELECT * FROM guilds WHERE id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });
    if (guild.joinType !== 'open') return res.status(400).json({ error: 'Гильдия доступна только по заявке или приглашению' });

    await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [guildId, userId, 'member']);
    await db.run('UPDATE users SET guildId = ? WHERE id = ?', [guildId, userId]);

    res.json({ success: true });
});

// Подать заявку
router.post('/guild/request/:id', async (req, res) => {
    const userId = req.userId;
    const guildId = parseInt(req.params.id);

    const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
    if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

    const guild = await db.one('SELECT * FROM guilds WHERE id = ?', [guildId]) as any;
    if (!guild) return res.status(404).json({ error: 'Гильдия не найдена' });
    if (guild.joinType !== 'request') return res.status(400).json({ error: 'Эта гильдия не принимает заявки' });

    const existing = await db.one(
        "SELECT id FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending'",
        [guildId, userId]
    );
    if (existing) return res.status(400).json({ error: 'Заявка уже отправлена' });

    await db.run('INSERT INTO guild_invites (guildId, userId, invitedBy) VALUES (?, ?, ?)', [guildId, userId, 0]);
    res.json({ success: true });
});

// Пригласить игрока (отправить ЛС)
router.post('/guild/invite', async (req, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member) return res.status(400).json({ error: 'Вы не состоите в гильдии' });
    if (member.rank !== 'leader' && member.rank !== 'officer') return res.status(400).json({ error: 'Только лидер и офицеры могут приглашать' });

    const target = await db.one('SELECT id, username, guildId FROM users WHERE id = ?', [targetId]) as any;
    if (!target) return res.status(404).json({ error: 'Игрок не найден' });
    if (target.guildId) return res.status(400).json({ error: 'Игрок уже в гильдии' });

    const existing = await db.one(
        "SELECT id, createdAt FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending'",
        [member.guildId, targetId]
    ) as any;
    if (existing) {
        const now = Math.floor(Date.now() / 1000);
        const inviteTime = Math.floor(new Date(existing.createdAt).getTime() / 1000);
        const elapsed = now - inviteTime;
        if (elapsed < 3600) {
            const remaining = Math.ceil((3600 - elapsed) / 60);
            return res.status(400).json({ error: `Приглашение уже отправлено. Повторно можно через ${remaining} мин` });
        }
        // Старое приглашение — отменяем
        await db.run("UPDATE guild_invites SET status = 'declined' WHERE id = ?", [existing.id]);
    }

    const guild = await db.one('SELECT name FROM guilds WHERE id = ?', [member.guildId]) as any;

    await db.run('INSERT INTO guild_invites (guildId, userId, invitedBy) VALUES (?, ?, ?)', [member.guildId, targetId, userId]);

    // ЛС с приглашением
    const inviter = await db.one('SELECT username FROM users WHERE id = ?', [userId]) as any;
    const msg = `🏚️ ${inviter.username} приглашает вас в гильдию «${guild.name}». Нажмите чтобы принять.`;
    const info = await db.run('INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, ?, ?, ?)', [0, targetId, msg, JSON.stringify({ type: 'guild_invite', guildId: member.guildId, guildName: guild.name })]);

    broadcast('message', { message: {
        id: info.lastInsertRowid, senderId: 0, senderName: 'system', targetId,
        content: msg, createdAt: new Date().toISOString(),
        item: { type: 'guild_invite', guildId: member.guildId, guildName: guild.name },
    }});

    res.json({ success: true });
});

// Принять / отклонить приглашение (по guildId)
router.post('/guild/accept-invite', async (req, res) => {
    const userId = req.userId;
    const { guildId, accept } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Укажите guildId' });

    const invite = await db.one(
        "SELECT * FROM guild_invites WHERE guildId = ? AND userId = ? AND status = 'pending' ORDER BY id DESC LIMIT 1",
        [guildId, userId]
    ) as any;
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

    if (accept) {
        const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
        if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

        await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [guildId, userId, 'member']);
        await db.run('UPDATE users SET guildId = ? WHERE id = ?', [guildId, userId]);
        await db.run("UPDATE guild_invites SET status = 'accepted' WHERE guildId = ? AND userId = ? AND status = 'pending'", [guildId, userId]);
    } else {
        await db.run("UPDATE guild_invites SET status = 'declined' WHERE guildId = ? AND userId = ? AND status = 'pending'", [guildId, userId]);
    }

    res.json({ success: true });
});

// Принять / отклонить приглашение (по ID)
router.post('/guild/invite/:id', async (req, res) => {
    const userId = req.userId;
    const inviteId = parseInt(req.params.id);
    const { accept } = req.body; // true/false

    const invite = await db.one('SELECT * FROM guild_invites WHERE id = ? AND userId = ? AND status = ?', [inviteId, userId, 'pending']) as any;
    if (!invite) return res.status(404).json({ error: 'Приглашение не найдено' });

    if (accept) {
        const alreadyInGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [userId]) as any;
        if (alreadyInGuild?.guildId) return res.status(400).json({ error: 'Вы уже состоите в гильдии' });

        await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [invite.guildId, userId, 'member']);
        await db.run('UPDATE users SET guildId = ? WHERE id = ?', [invite.guildId, userId]);
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['accepted', inviteId]);
    } else {
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['declined', inviteId]);
    }

    // Удаляем другие pending приглашения для этого игрока
    if (accept) {
        await db.run("DELETE FROM guild_invites WHERE userId = ? AND id != ? AND status = 'pending'", [userId, inviteId]);
    }

    res.json({ success: true });
});

// Принять/отклонить заявку (для лидера/офицеров)
router.post('/guild/handle-request', async (req, res) => {
    const userId = req.userId;
    const { requestId, accept } = req.body;

    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const invite = await db.one("SELECT * FROM guild_invites WHERE id = ? AND guildId = ? AND status = 'pending'", [requestId, member.guildId]) as any;
    if (!invite) return res.status(404).json({ error: 'Заявка не найдена' });

    if (accept) {
        const targetGuild = await db.one('SELECT guildId FROM users WHERE id = ?', [invite.userId]) as any;
        if (targetGuild?.guildId) return res.status(400).json({ error: 'Игрок уже в гильдии' });

        await db.run('INSERT INTO guild_members (guildId, userId, rank) VALUES (?, ?, ?)', [member.guildId, invite.userId, 'member']);
        await db.run('UPDATE users SET guildId = ? WHERE id = ?', [member.guildId, invite.userId]);
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['accepted', requestId]);
    } else {
        await db.run('UPDATE guild_invites SET status = ? WHERE id = ?', ['declined', requestId]);
    }

    res.json({ success: true });
});

// Покинуть гильдию
router.post('/guild/kick', async (req, res) => {
    const userId = req.userId;
    const { targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Укажите targetId' });

    const actor = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!actor || (actor.rank !== 'leader' && actor.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const target = await db.one('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?', [actor.guildId, targetId]) as any;
    if (!target) return res.status(400).json({ error: 'Игрок не в гильдии' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Нельзя исключить лидера' });
    if (actor.rank === 'officer' && target.rank === 'officer') return res.status(400).json({ error: 'Офицер не может исключить другого офицера' });

    await db.run('DELETE FROM guild_members WHERE guildId = ? AND userId = ?', [actor.guildId, targetId]);
    await db.run('UPDATE users SET guildId = NULL WHERE id = ?', [targetId]);

    res.json({ success: true });
});

// Сменить роль участника (только лидер)
router.post('/guild/role', async (req, res) => {
    const userId = req.userId;
    const { targetId, rank } = req.body;
    if (!targetId || !rank) return res.status(400).json({ error: 'Укажите targetId и rank' });
    if (!['officer', 'member'].includes(rank)) return res.status(400).json({ error: 'Неверный ранг' });

    const actor = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!actor || actor.rank !== 'leader') return res.status(400).json({ error: 'Только лидер может менять роли' });

    const target = await db.one('SELECT * FROM guild_members WHERE guildId = ? AND userId = ?', [actor.guildId, targetId]) as any;
    if (!target) return res.status(400).json({ error: 'Игрок не в гильдии' });
    if (target.rank === 'leader') return res.status(400).json({ error: 'Нельзя изменить роль лидера' });

    await db.run('UPDATE guild_members SET rank = ? WHERE guildId = ? AND userId = ?', [rank, actor.guildId, targetId]);
    res.json({ success: true });
});

// Отменить все отправленные приглашения (лидер/офицер)
router.post('/guild/cancel-invites', async (req, res) => {
    const userId = req.userId;
    const member = await db.one('SELECT * FROM guild_members WHERE userId = ?', [userId]) as any;
    if (!member || (member.rank !== 'leader' && member.rank !== 'officer')) return res.status(400).json({ error: 'Нет прав' });

    const info = await db.run(
        "UPDATE guild_invites SET status = 'declined' WHERE guildId = ? AND status = 'pending'",
        [member.guildId]
    );
    res.json({ success: true, cancelled: info.changes });
});


export default router;
