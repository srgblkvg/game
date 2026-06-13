import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import xss from 'xss';
import db from './database';
import { wsPublicMessageSchema, wsPrivateMessageSchema, wsItemLinkSchema } from './validation';
import { isGuestRestrictionsDisabled } from './middleware/auth';
import { auditWsConnect, auditWsDisconnect } from './audit';

const JWT_SECRET = process.env.JWT_SECRET!;

// Санитизация контента от XSS
const sanitize = (text: string) => xss(text, { whiteList: {}, stripIgnoreTag: true });

// Интервал пинг-понга (секунды)
const HEARTBEAT_INTERVAL = 30;

interface OnlineUser {
  id: number;
  username: string;
  level: number;
  guildName?: string | null;
}

const clients = new Map<number, WebSocket>();
const onlineUsers = new Map<number, OnlineUser>();

// ---------- Рассылка ----------
function broadcast(type: string, data: any, exceptUserId?: number) {
  const payload = JSON.stringify({ type, ...data });
  clients.forEach((ws, userId) => {
    if (userId !== exceptUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export { broadcast };

function sendToUser(userId: number, payload: object) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function notifyUserOnline(user: OnlineUser) {
  broadcast('userOnline', { user });
}

function notifyUserOffline(userId: number) {
  broadcast('userOffline', { userId });
}

// ---------- Heartbeat ----------
function heartbeat(ws: WebSocket & { isAlive?: boolean }) {
  ws.isAlive = true;
}

export async function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server });

  // Интервал проверки живых соединений
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const alive = (ws as WebSocket & { isAlive?: boolean }).isAlive;
      if (alive === false) return ws.terminate(); // мёртвое соединение
      (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
      ws.ping(); // отправляем пинг
    });
  }, HEARTBEAT_INTERVAL * 1000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // ---------- Подключение ----------
  wss.on('connection', (ws: WebSocket, req) => {
    // Инициализация heartbeat-флага
    (ws as WebSocket & { isAlive?: boolean }).isAlive = true;
    ws.on('pong', () => heartbeat(ws));

    const url = new URL(req.url!, 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    // ---------- Администратор ----------
    if (decoded.role === 'admin') {
      const admin = await db.prepare('SELECT id, username FROM admins WHERE id = ?').get(decoded.adminId) as any;
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
    const user = await db.prepare('SELECT u.id, u.username, u.level, u.chatBannedUntil, u.isGuest, g.name as guildName, u.guildId FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?').get(userId) as any;
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
    const onlineUser: OnlineUser = { id: user.id, username: user.username, level: user.level, guildName: user.guildName || null };
    onlineUsers.set(userId, onlineUser);
    auditWsConnect(user.username, user.id);

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
      let data: any;
      try { data = JSON.parse(raw.toString()); } catch { return; }

      const currentUser = await db.prepare('SELECT chatBannedUntil FROM users WHERE id = ?').get(userId) as any;
      if (currentUser && currentUser.chatBannedUntil && currentUser.chatBannedUntil > Math.floor(Date.now() / 1000)) {
        sendToUser(userId, {
          type: 'chatBanned',
          until: currentUser.chatBannedUntil,
        });
        return;
      }

      // Гостям чат запрещён — отключено
      /* if (user.isGuest && !isGuestRestrictionsDisabled()) {
        sendToUser(userId, {
          type: 'error',
          message: 'Гостевой аккаунт не может писать в чат. Зарегистрируйтесь в разделе Аккаунт.',
        });
        return;
      } */

      // Отправка предмета в чат
      if (data.type === 'itemLink') {
        const parsed = wsItemLinkSchema.safeParse(data);
        if (!parsed.success) return;
        let item = data.itemData;
        if (!item) {
          const itemId = data.itemId;
          if (!itemId) return;
          const currentUser = await db.prepare('SELECT inventory FROM users WHERE id = ?').get(userId) as any;
          const inventory = JSON.parse(currentUser.inventory || '[]');
          item = inventory.find((i: any) => i.id == itemId);
        }
        if (!item) return;

        const stmt = await db.prepare('INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, NULL, ?, ?)');
        const itemDataJson = JSON.stringify(item);
        const itemName = sanitize(item.name);
        const info = stmt.run(userId, `[${itemName}]`, itemDataJson);
        const msg = {
          id: info.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          senderGuild: user.guildName || null,
          senderGuildId: user.guildId || null,
          targetId: null,
          content: `[${itemName}]`,
          createdAt: new Date().toISOString(),
          item: item,
          itemRarity: item.rarity_id ?? item.rarity,
        };
        broadcast('message', { message: msg });
        return;
      }

      if (data.type === 'public') {
        const parsed = wsPublicMessageSchema.safeParse(data);
        if (!parsed.success) {
          sendToUser(userId, { type: 'error', message: 'Некорректное сообщение' });
          return;
        }
        const content: string = data.content.trim();

        // Команда /w — ЛС
        if (content.startsWith('/w ')) {
          const withoutCommand = content.slice(3).trim();
          const spaceIndex = withoutCommand.indexOf(' ');
          if (spaceIndex === -1) return;
          const targetName = withoutCommand.slice(0, spaceIndex).toLowerCase();
          const privateContent = withoutCommand.slice(spaceIndex + 1).trim();
          if (!privateContent) return;

          const targetUser = await db.prepare('SELECT id FROM users WHERE LOWER(username) = ?').get(targetName) as any;
          if (!targetUser) {
            sendToUser(userId, { type: 'error', message: 'Пользователь не найден' });
            return;
          }
          if (targetUser.id === userId) {
            sendToUser(userId, { type: 'error', message: 'Нельзя отправить личное сообщение самому себе' });
            return;
          }

          const stmt = await db.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)');
          const sanitizedPrivate = sanitize(privateContent);
          const info = stmt.run(userId, targetUser.id, sanitizedPrivate);
          const msg = {
            id: info.lastInsertRowid,
            senderId: userId,
            senderName: user.username,
            targetId: targetUser.id,
            content: sanitizedPrivate,
            createdAt: new Date().toISOString(),
          };

          sendToUser(userId, { type: 'message', message: msg });
          if (clients.has(targetUser.id)) {
            sendToUser(targetUser.id, { type: 'message', message: msg });
          }
          return;
        }

        // Обычное сообщение в общий чат
        const sanitizedContent = sanitize(content);
        const stmt = await db.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, NULL, ?)');
        const info = stmt.run(userId, sanitizedContent);
        const msg = {
          id: info.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          senderGuild: user.guildName || null,
          senderGuildId: user.guildId || null,
          targetId: null,
          content: sanitizedContent,
          createdAt: new Date().toISOString(),
        };
        broadcast('message', { message: msg });
      } else if (data.type === 'private') {
        const parsed = wsPrivateMessageSchema.safeParse(data);
        if (!parsed.success) {
          sendToUser(userId, { type: 'error', message: 'Некорректное сообщение' });
          return;
        }
        const targetId = data.targetUserId;
        if (!targetId) return;
        const sanitizedContent = sanitize(data.content);
        const stmt = await db.prepare('INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)');
        const info = stmt.run(userId, targetId, sanitizedContent);
        const msg = {
          id: info.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          senderGuild: user.guildName || null,
          senderGuildId: user.guildId || null,
          targetId,
          content: sanitizedContent,
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
      auditWsDisconnect(user.username, userId);
      notifyUserOffline(userId);
    });
  });
}