"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.broadcastGuild = broadcastGuild;
exports.broadcastAll = broadcastAll;
exports.setupSSE = setupSSE;
// SSE (Server-Sent Events) — push уведомлений гильдий и аукциона
const index_1 = require("./db/index");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = proces;
const sseClients = new Map();
// Подписать всех участников гильдии на событие
function broadcastGuild(guildId, data) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach((res, userId) => {
        if (res.guildId === guildId) {
            try {
                res.write(msg);
            }
            catch { }
        }
    });
}
// Всем подключённым
function broadcastAll(data) {
    const msg = `data: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(res => {
        try {
            res.write(msg);
        }
        catch { }
    });
}
function setupSSE(app) {
    app.get('/api/sse', async (req, res) => {
        const token = req.query.token;
        if (!token)
            return res.status(401).json({ error: 'Token required' });
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch {
            return res.status(401).json({ error: 'Invalid token' });
        }
        const userId = decoded.userId;
        if (!userId)
            return res.status(401).json({ error: 'User not found' });
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        // Закрыть старый коннект
        const old = sseClients.get(userId);
        if (old) {
            try {
                old.end();
            }
            catch { }
        }
        // Загрузить guildId пользователя
        let guildId = null;
        try {
            const u = await index_1.db.one('SELECT guildId FROM users WHERE id = ?', [userId]);
            guildId = u?.guildid ?? u?.guildId ?? null;
        }
        catch { }
        res.guildId = guildId;
        sseClients.set(userId, res);
        // Keep-alive каждые 15с
        const keepAlive = setInterval(() => {
            try {
                res.write(':keepalive\n\n');
            }
            catch { }
        }, 15000);
        req.on('close', () => {
            clearInterval(keepAlive);
            sseClients.delete(userId);
        });
    });
}
//# sourceMappingURL=sse.js.map