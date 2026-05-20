"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = setupWebSocket;
const ws_1 = require("ws");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("./database"));
const JWT_SECRET = process.env.JWT_SECRET;
// Интервал пинг-понга (секунды)
const HEARTBEAT_INTERVAL = 30;
const clients = new Map();
const onlineUsers = new Map();
// ---------- Рассылка ----------
function broadcast(type, data, exceptUserId) {
    const payload = JSON.stringify({ type, ...data });
    clients.forEach((ws, userId) => {
        if (userId !== exceptUserId && ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(payload);
        }
    });
}
function sendToUser(userId, payload) {
    const ws = clients.get(userId);
    if (ws && ws.readyState === ws_1.WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}
function notifyUserOnline(user) {
    broadcast('userOnline', { user });
}
function notifyUserOffline(userId) {
    broadcast('userOffline', { userId });
}
// ---------- Heartbeat ----------
function heartbeat(ws) {
    ws.isAlive = true;
}
function setupWebSocket(server) {
    const wss = new ws_1.WebSocketServer({ server });
    // Интервал проверки живых соединений
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const alive = ws.isAlive;
            if (alive === false)
                return ws.terminate(); // мёртвое соединение
            ws.isAlive = false;
            ws.ping(); // отправляем пинг
        });
    }, HEARTBEAT_INTERVAL * 1000);
    wss.on('close', () => {
        clearInterval(interval);
    });
    // ---------- Подключение ----------
    wss.on('connection', (ws, req) => {
        // Инициализация heartbeat-флага
        ws.isAlive = true;
        ws.on('pong', () => heartbeat(ws));
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        if (!token) {
            ws.close(1008, 'Token required');
            return;
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch {
            ws.close(1008, 'Invalid token');
            return;
        }
        // ---------- Администратор ----------
        if (decoded.role === 'admin') {
            const admin = database_1.default.prepare('SELECT id, username FROM admins WHERE id = ?').get(decoded.adminId);
            if (!admin) {
                ws.close(1008, 'Admin not found');
                return;
            }
            const adminId = -admin.id;
            clients.set(adminId, ws);
            ws.send(JSON.stringify({
                type: 'onlineUsers',
                users: Array.from(onlineUsers.values()),
            }));
            ws.on('message', () => { });
            ws.on('close', () => {
                clients.delete(adminId);
            });
            return;
        }
        // ---------- Игрок ----------
        const userId = decoded.userId;
        const user = database_1.default.prepare('SELECT id, username, level, chatBannedUntil FROM users WHERE id = ?').get(userId);
        if (!user) {
            ws.close(1008, 'User not found');
            return;
        }
        // Закрываем предыдущее соединение, если было
        const existingWs = clients.get(userId);
        if (existingWs) {
            existingWs.close(1000, 'New connection');
        }
        clients.set(userId, ws);
        const onlineUser = { id: user.id, username: user.username, level: user.level };
        onlineUsers.set(userId, onlineUser);
        // Отправляем текущий список онлайна
        ws.send(JSON.stringify({
            type: 'onlineUsers',
            users: Array.from(onlineUsers.values()),
        }));
        // Проверка бана в чате
        if (user.chatBannedUntil && user.chatBannedUntil > Math.floor(Date.now() / 1000)) {
            ws.send(JSON.stringify({
                type: 'chatBanned',
                until: user.chatBannedUntil,
            }));
        }
        // Уведомляем всех о входе
        notifyUserOnline(onlineUser);
        // ---------- Обработка сообщений ----------
        ws.on('message', (raw) => {
            let data;
            try {
                data = JSON.parse(raw.toString());
            }
            catch {
                return;
            }
            const currentUser = database_1.default.prepare('SELECT chatBannedUntil FROM users WHERE id = ?').get(userId);
            if (currentUser && currentUser.chatBannedUntil && currentUser.chatBannedUntil > Math.floor(Date.now() / 1000)) {
                sendToUser(userId, {
                    type: 'chatBanned',
                    until: currentUser.chatBannedUntil,
                });
                return;
            }
            // Отправка предмета в чат
            if (data.type === 'itemLink') {
                let item = data.itemData;
                if (!item) {
                    const itemId = data.itemId;
                    if (!itemId)
                        return;
                    const currentUser = database_1.default.prepare('SELECT inventory FROM users WHERE id = ?').get(userId);
                    const inventory = JSON.parse(currentUser.inventory || '[]');
                    item = inventory.find((i) => i.id == itemId);
                }
                if (!item || item.type === 'material')
                    return;
                const stmt = database_1.default.prepare('INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, NULL, ?, ?)');
                const itemDataJson = JSON.stringify(item);
                const info = stmt.run(userId, `[${item.name}]`, itemDataJson);
                const msg = {
                    id: info.lastInsertRowid,
                    senderId: userId,
                    senderName: user.username,
                    targetId: null,
                    content: `[${item.name}]`,
                    createdAt: new Date().toISOString(),
                    item: item,
                    itemRarity: item.rarity,
                };
                broadcast('message', { message: msg });
                return;
            }
            if (data.type === 'public') {
                const content = data.content.trim();
                // Команда /w — шепот
                if (content.startsWith('/w ')) {
                    const withoutCommand = content.slice(3).trim();
                    const spaceIndex = withoutCommand.indexOf(' ');
                    if (spaceIndex === -1)
                        return;
                    const targetName = withoutCommand.slice(0, spaceIndex).toLowerCase();
                    const privateContent = withoutCommand.slice(spaceIndex + 1).trim();
                    if (!privateContent)
                        return;
                    const targetUser = database_1.default.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(targetName);
                    if (!targetUser || targetUser.id === userId) {
                        sendToUser(userId, { type: 'error', message: 'Пользователь не найден' });
                        return;
                    }
                    const stmt = database_1.default.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)');
                    const info = stmt.run(userId, targetUser.id, privateContent);
                    const msg = {
                        id: info.lastInsertRowid,
                        senderId: userId,
                        senderName: user.username,
                        targetId: targetUser.id,
                        content: privateContent,
                        createdAt: new Date().toISOString(),
                    };
                    sendToUser(userId, { type: 'message', message: msg });
                    if (clients.has(targetUser.id)) {
                        sendToUser(targetUser.id, { type: 'message', message: msg });
                    }
                    return;
                }
                // Обычное сообщение в общий чат
                const stmt = database_1.default.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, NULL, ?)');
                const info = stmt.run(userId, content);
                const msg = {
                    id: info.lastInsertRowid,
                    senderId: userId,
                    senderName: user.username,
                    targetId: null,
                    content,
                    createdAt: new Date().toISOString(),
                };
                broadcast('message', { message: msg });
            }
            else if (data.type === 'private') {
                const targetId = data.targetUserId;
                if (!targetId)
                    return;
                const stmt = database_1.default.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)');
                const info = stmt.run(userId, targetId, data.content);
                const msg = {
                    id: info.lastInsertRowid,
                    senderId: userId,
                    senderName: user.username,
                    targetId,
                    content: data.content,
                    createdAt: new Date().toISOString(),
                };
                sendToUser(userId, { type: 'message', message: msg });
                if (targetId !== userId) {
                    sendToUser(targetId, { type: 'message', message: msg });
                }
            }
        });
        // ---------- Отключение ----------
        ws.on('close', () => {
            clients.delete(userId);
            onlineUsers.delete(userId);
            notifyUserOffline(userId);
        });
    });
}
//# sourceMappingURL=websocket.js.map