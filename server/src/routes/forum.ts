import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

// Список тем (последние активные)
router.get('/forum/threads', async (req, res) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const offset = (page - 1) * limit;

    const threads = await db.query(`
        SELECT t.*,
               COALESCE(u.username, 'Пользователь удалён') as author_name, u.avatar as author_avatar, u.guildId as author_guild,
               g.name as author_guild_name,
               COALESCE(lp.username, 'Пользователь удалён') as last_poster_name, lp.avatar as last_poster_avatar,
               lp.guildId as last_poster_guild, lg.name as last_poster_guild_name
        FROM forum_threads t
        LEFT JOIN users u ON t.author_id = u.id
        LEFT JOIN users lp ON (SELECT author_id FROM forum_posts WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) = lp.id
        LEFT JOIN guilds g ON u.guildId = g.id
        LEFT JOIN guilds lg ON lp.guildId = lg.id
        ORDER BY t.updated_at DESC
        LIMIT ? OFFSET ?
    `, [limit, offset]) as any[];

    const total = (await db.one('SELECT COUNT(*) as cnt FROM forum_threads', []) as any).cnt;

    res.json({ threads, total, page, totalPages: Math.ceil(total / limit) });
});

// Одна тема с сообщениями
router.get('/forum/thread/:id', async (req, res) => {
    const threadId = parseInt(req.params.id);
    const limit = 9; // 9 + 1 первый = 10 на странице
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;

    const thread = await db.one(`
        SELECT t.*, COALESCE(u.username, 'Пользователь удалён') as author_name
        FROM forum_threads t
        LEFT JOIN users u ON t.author_id = u.id
        WHERE t.id = ?
    `, [threadId]) as any;

    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });

    // Первый пост всегда отдельно
    const firstPost = await db.one(`
        SELECT p.*,
               COALESCE(u.username, 'Пользователь удалён') as author_name, u.avatar as author_avatar,
               u.guildId as author_guild, g.name as author_guild_name
        FROM forum_posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        WHERE p.thread_id = ?
        ORDER BY p.created_at ASC
        LIMIT 1
    `, [threadId]) as any;

    // Остальные посты (без первого)
    const posts = await db.query(`
        SELECT p.*,
               COALESCE(u.username, 'Пользователь удалён') as author_name, u.avatar as author_avatar,
               u.guildId as author_guild, g.name as author_guild_name
        FROM forum_posts p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        WHERE p.thread_id = ? AND p.id != ?
        ORDER BY p.created_at ASC
        LIMIT ? OFFSET ?
    `, [threadId, firstPost.id, limit, offset]) as any[];

    const total = (await db.one('SELECT COUNT(*) as cnt FROM forum_posts WHERE thread_id = ?', [threadId]) as any).cnt;
    const totalPages = Math.max(1, Math.ceil((total - 1) / limit));

    // Опрос
    let poll: any = null;
    const pollRow = await db.one('SELECT * FROM forum_polls WHERE thread_id = ?', [threadId]) as any;
    if (pollRow) {
        const options = await db.query(
            'SELECT * FROM forum_poll_options WHERE poll_id = ? ORDER BY id',
            [pollRow.id]
        ) as any[];
        poll = { ...pollRow, options };
    }

    res.json({ thread, firstPost, posts, total, page, totalPages: Math.max(1, totalPages), poll });
});

// Создать тему
router.post('/forum/thread', async (req, res) => {
    const userId = req.userId;
    const { title, content, poll } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Название и текст обязательны' });
    if (title.length > 200) return res.status(400).json({ error: 'Название слишком длинное' });

    // Валидация опроса
    if (poll) {
        if (!poll.question || !poll.question.trim()) return res.status(400).json({ error: 'Вопрос опроса обязателен' });
        if (!Array.isArray(poll.options) || poll.options.length < 2 || poll.options.length > 10) {
            return res.status(400).json({ error: 'Нужно от 2 до 10 вариантов ответа' });
        }
        const validOptions = poll.options.filter((o: any) => o && String(o).trim());
        if (validOptions.length < 2) return res.status(400).json({ error: 'Нужно минимум 2 непустых варианта' });
    }

    const now = new Date().toISOString();
    const result = await db.run(
        'INSERT INTO forum_threads (title, author_id, created_at, updated_at) VALUES (?, ?, ?, ?)',
        [title, userId, now, now]
    );
    const threadId = Number((result as any).lastInsertRowid);

    await db.run(
        'INSERT INTO forum_posts (thread_id, author_id, content, created_at) VALUES (?, ?, ?, ?)',
        [threadId, userId, content, now]
    );

    // Создать опрос
    if (poll) {
        const pollResult = await db.run(
            'INSERT INTO forum_polls (thread_id, question) VALUES (?, ?)',
            [threadId, poll.question.trim()]
        );
        const pollId = Number((pollResult as any).lastInsertRowid);

        const validOptions = poll.options.filter((o: any) => o && String(o).trim());
        for (const opt of validOptions) {
            await db.run(
                'INSERT INTO forum_poll_options (poll_id, option_text) VALUES (?, ?)',
                [pollId, String(opt).trim()]
            );
        }
    }

    res.json({ id: threadId });
});

// Голосовать в опросе
router.post('/forum/poll/vote', async (req, res) => {
    const userId = req.userId;
    const { threadId, optionId } = req.body;
    if (!threadId || !optionId) return res.status(400).json({ error: 'threadId и optionId обязательны' });

    // Проверить, что тема не закрыта
    const thread = await db.one('SELECT is_closed FROM forum_threads WHERE id = ?', [threadId]) as any;
    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });
    if (thread.is_closed) return res.status(403).json({ error: 'Тема закрыта' });

    const poll = await db.one(
        'SELECT p.* FROM forum_polls p WHERE p.thread_id = ?',
        [threadId]
    ) as any;
    if (!poll) return res.status(404).json({ error: 'Опрос не найден' });

    // Проверить, что option принадлежит этому опросу
    const option = await db.one(
        'SELECT * FROM forum_poll_options WHERE id = ? AND poll_id = ?',
        [optionId, poll.id]
    ) as any;
    if (!option) return res.status(400).json({ error: 'Вариант не найден' });

    // Проверить, не голосовал ли уже
    const existing = await db.one(
        'SELECT * FROM forum_poll_votes WHERE poll_id = ? AND user_id = ?',
        [poll.id, userId]
    ) as any;
    if (existing) return res.status(400).json({ error: 'Вы уже голосовали' });

    await db.run(
        'INSERT INTO forum_poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)',
        [poll.id, optionId, userId]
    );
    await db.run(
        'UPDATE forum_poll_options SET votes_count = votes_count + 1 WHERE id = ?',
        [optionId]
    );

    // Вернуть обновлённые результаты
    const options = await db.query(
        'SELECT * FROM forum_poll_options WHERE poll_id = ? ORDER BY id',
        [poll.id]
    ) as any[];
    const totalVotes = options.reduce((sum: number, o: any) => sum + (o.votes_count || 0), 0);

    res.json({ success: true, options, totalVotes });
});

// Ответить в тему
router.post('/forum/reply', async (req, res) => {
    const userId = req.userId;
    const { threadId, content, parentId } = req.body;
    if (!threadId || !content) return res.status(400).json({ error: 'Текст обязателен' });

    const thread = await db.one('SELECT id, is_closed FROM forum_threads WHERE id = ?', [threadId]);
    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });
    if (thread.is_closed) return res.status(403).json({ error: 'Тема закрыта' });

    const now = new Date().toISOString();
    await db.run(
        'INSERT INTO forum_posts (thread_id, author_id, content, created_at, parent_id) VALUES (?, ?, ?, ?, ?)',
        [threadId, userId, content, now, parentId || null]
    );
    await db.run(
        'UPDATE forum_threads SET updated_at = ?, posts_count = posts_count + 1 WHERE id = ?',
        [now, threadId]
    );

    res.json({ success: true });
});

// Закрыть/открыть тему (только автор темы)
router.put('/forum/thread/:id/close', async (req, res) => {
    const userId = req.userId;
    const thread = await db.one('SELECT id, author_id FROM forum_threads WHERE id = ?', [parseInt(req.params.id)]);
    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });
    if (thread.author_id !== userId) return res.status(403).json({ error: 'Только автор может закрыть тему' });
    const { closed } = req.body;
    await db.run('UPDATE forum_threads SET is_closed = ? WHERE id = ?', [closed ? 1 : 0, thread.id]);
    res.json({ success: true, is_closed: !!closed });
});

// Редактировать тему (только автор темы)
router.put('/forum/thread/:id', async (req, res) => {
    const userId = req.userId;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Название обязательно' });
    const thread = await db.one('SELECT id, author_id, is_closed FROM forum_threads WHERE id = ?', [parseInt(req.params.id)]);
    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });
    if (thread.is_closed) return res.status(403).json({ error: 'Тема закрыта' });
    if (thread.author_id !== userId) return res.status(403).json({ error: 'Только автор может редактировать тему' });
    await db.run('UPDATE forum_threads SET title = ? WHERE id = ?', [title, thread.id]);
    res.json({ success: true });
});

// Редактировать сообщение (только автор)
router.put('/forum/post/:id', async (req, res) => {
    const userId = req.userId;
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Текст обязателен' });
    const post = await db.one(
        'SELECT p.id, p.author_id, t.is_closed FROM forum_posts p JOIN forum_threads t ON p.thread_id = t.id WHERE p.id = ?',
        [parseInt(req.params.id)]
    ) as any;
    if (!post) return res.status(404).json({ error: 'Сообщение не найдено' });
    if (post.is_closed) return res.status(403).json({ error: 'Тема закрыта' });
    if (post.author_id !== userId) return res.status(403).json({ error: 'Только автор может редактировать' });
    await db.run('UPDATE forum_posts SET content = ?, updated_at = ? WHERE id = ?',
        [content, new Date().toISOString(), post.id]);
    res.json({ success: true });
});

// Последние 3 темы (для замка)
router.get('/forum/latest', async (_req, res) => {
    const threads = await db.query(`
        SELECT t.*,
               COALESCE(u.username, 'Пользователь удалён') as author_name,
               COALESCE(lp.username, 'Пользователь удалён') as last_poster_name
        FROM forum_threads t
        LEFT JOIN users u ON t.author_id = u.id
        LEFT JOIN users lp ON (SELECT author_id FROM forum_posts WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) = lp.id
        ORDER BY t.updated_at DESC
        LIMIT 3
    `, []) as any[];
    res.json(threads);
});

export default router;
