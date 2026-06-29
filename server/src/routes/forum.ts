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
               u.username as author_name, u.avatar as author_avatar, u.guildId as author_guild,
               g.name as author_guild_name,
               lp.username as last_poster_name, lp.avatar as last_poster_avatar,
               lp.guildId as last_poster_guild, lg.name as last_poster_guild_name
        FROM forum_threads t
        JOIN users u ON t.author_id = u.id
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
    const offset = page > 1 ? (page - 2) * limit + 1 : 0; // страница 1 = 0..8, стр 2 = 10..19 (пропускаем первый)

    const thread = await db.one(`
        SELECT t.*, u.username as author_name
        FROM forum_threads t
        JOIN users u ON t.author_id = u.id
        WHERE t.id = ?
    `, [threadId]) as any;

    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });

    // Первый пост всегда отдельно
    const firstPost = await db.one(`
        SELECT p.*,
               u.username as author_name, u.avatar as author_avatar,
               u.guildId as author_guild, g.name as author_guild_name
        FROM forum_posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        WHERE p.thread_id = ?
        ORDER BY p.created_at ASC
        LIMIT 1
    `, [threadId]) as any;

    // Остальные посты (без первого)
    const posts = await db.query(`
        SELECT p.*,
               u.username as author_name, u.avatar as author_avatar,
               u.guildId as author_guild, g.name as author_guild_name
        FROM forum_posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN guilds g ON u.guildId = g.id
        WHERE p.thread_id = ? AND p.id != ?
        ORDER BY p.created_at ASC
        LIMIT ? OFFSET ?
    `, [threadId, firstPost.id, limit, offset]) as any[];

    const total = (await db.one('SELECT COUNT(*) as cnt FROM forum_posts WHERE thread_id = ?', [threadId]) as any).cnt;
    const totalPages = Math.max(1, Math.ceil((total - 1) / limit));
    // Если page = 1, показываем первый пост + 9 остальных
    // Если page = 2, показываем первый пост + след. 9 (пропуская 9 из page 1)

    res.json({ thread, firstPost, posts, total, page, totalPages: Math.max(1, totalPages) });
});

// Создать тему
router.post('/forum/thread', async (req, res) => {
    const userId = req.userId;
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Название и текст обязательны' });
    if (title.length > 200) return res.status(400).json({ error: 'Название слишком длинное' });

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

    res.json({ id: threadId });
});

// Ответить в тему
router.post('/forum/reply', async (req, res) => {
    const userId = req.userId;
    const { threadId, content, parentId } = req.body;
    if (!threadId || !content) return res.status(400).json({ error: 'Текст обязателен' });

    const thread = await db.one('SELECT id FROM forum_threads WHERE id = ?', [threadId]);
    if (!thread) return res.status(404).json({ error: 'Тема не найдена' });

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

// Последние 3 темы (для замка)
router.get('/forum/latest', async (_req, res) => {
    const threads = await db.query(`
        SELECT t.*,
               u.username as author_name,
               lp.username as last_poster_name
        FROM forum_threads t
        JOIN users u ON t.author_id = u.id
        LEFT JOIN users lp ON (SELECT author_id FROM forum_posts WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1) = lp.id
        ORDER BY t.updated_at DESC
        LIMIT 3
    `, []) as any[];
    res.json(threads);
});

export default router;
