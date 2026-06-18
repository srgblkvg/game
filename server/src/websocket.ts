import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import xss from 'xss';
import { db } from './db/index';
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
  guildId?: number | null;
}

export interface Notification {
  type: 'quest_complete' | 'level_up' | 'battle_result' | 'guild_event' | 'auction_won' | 'auction_outbid' | 'auction_sold' | 'system';
  message: string;
  data?: any;
  id: number; // уникальный id для дедупликации на клиенте
  createdAt: number;
}

const clients = new Map<number, WebSocket>();
const onlineUsers = new Map<number, OnlineUser>();

// ---------- Dirty-флаги для serverTick ----------
type DirtyType = 'quests' | 'rating' | 'notifications';
const userDirtyFlags = new Map<number, Set<DirtyType>>();

let _notificationSeq = 0;

/** Пометить пользователя — на следующем serverTick ему отправятся свежие данные */
export function markDirty(userId: number, ...types: DirtyType[]) {
  if (!clients.has(userId)) return;
  let flags = userDirtyFlags.get(userId);
  if (!flags) {
    flags = new Set();
    userDirtyFlags.set(userId, flags);
  }
  for (const t of types) flags.add(t);
}

/** Очередь уведомлений на отправку через serverTick */
const notificationQueues = new Map<number, Notification[]>();

/** Добавить уведомление пользователю — отправится на ближайшем serverTick */
export function pushNotification(userId: number, notification: Omit<Notification, 'id' | 'createdAt'>) {
  const queue = notificationQueues.get(userId) || [];
  queue.push({
    ...notification,
    id: ++_notificationSeq,
    createdAt: Math.floor(Date.now() / 1000),
  });
  notificationQueues.set(userId, queue);
  markDirty(userId, 'notifications');
}

// ---------- Рассылка ----------
async function broadcast(type: string, data: any, exceptUserId?: number) {
  const payload = JSON.stringify({ type, ...data });
  clients.forEach((ws, userId) => {
    if (userId !== exceptUserId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

export { broadcast };

async function sendToUser(userId: number, payload: object) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

export { sendToUser };

export async function sendToGuild(guildId: number, payload: object) {
  const msg = JSON.stringify(payload);
  onlineUsers.forEach((user, userId) => {
    if (user.guildId === guildId) {
      const ws = clients.get(userId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    }
  });
}

async function notifyUserOnline(user: OnlineUser) {
  broadcast('userOnline', { user });
}

async function notifyUserOffline(userId: number) {
  broadcast('userOffline', { userId });
}

// ---------- Heartbeat ----------
async function heartbeat(ws: WebSocket & { isAlive?: boolean }) {
  ws.isAlive = true;
}

// ---------- Вычислялки для serverTick ----------

import { getToday, getProgress, QUEST_INFO, DIFFICULTIES } from './game/questData';

async function computeQuestData(userId: number) {
  const today = await getToday();
  const quests = await db.query(
    'SELECT * FROM daily_quests WHERE userId = ? AND date = ? ORDER BY id',
    [userId, today]
  ) as any[];

  if (quests.length === 0) return null;

  for (const q of quests) {
    if (q.status === 'active') {
      const prog = await getProgress(userId, q.snapshot, q.questType);
      if (prog !== q.progress) {
        await db.run('UPDATE daily_quests SET progress = ? WHERE id = ?', [Math.min(prog, q.requirement), q.id]);
        q.progress = Math.min(prog, q.requirement);
      }
    }
  }

  const active = quests.filter((q: any) => q.status === 'active');
  const typeQuest: any = QUEST_INFO;
  const typeDiff: any = DIFFICULTIES;

  return {
    quests: quests.filter((q: any) => q.status !== 'claimed').map((q: any) => {
      const qt = q.questType as any;
      const info = typeQuest[qt];
      return {
        ...q,
        typeName: info?.name,
        typeIcon: info?.icon,
        description: info?.desc ? info.desc(q.requirement, q.difficulty) : '',
        difficultyLabel: typeDiff[q.difficulty]?.label || q.difficulty,
        snapshot: undefined,
      };
    }),
    activeCount: active.length,
    completedToday: quests.filter((q: any) => q.status === 'claimed').length,
    canTake: active.length < 3 && (active.length + quests.filter((q: any) => q.status === 'claimed').length) < 5,
    dailyLimit: 5,
    maxActive: 3,
  };
}

import { getRank } from './routes/rating';

async function computeRatingData(userId: number) {
  const user = await db.one('SELECT elo FROM users WHERE id = ?', [userId]) as any;
  if (!user) return null;
  const elo = user.elo || 1000;
  const position = (await db.one(
    'SELECT COUNT(*) as cnt FROM users WHERE id > 0 AND (elo > ? OR (elo = ? AND id < ?))',
    [elo, elo, userId]
  ) as any).cnt + 1;
  const total = (await db.one('SELECT COUNT(*) as cnt FROM users WHERE id > 0', []) as any).cnt;
  const rank = getRank(elo);
  return { elo, position, total, rank };
}

// ---------- serverTick: персональные данные каждому ----------
async function sendServerTick(userId: number, time: number) {
  const ws = clients.get(userId);
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const flags = userDirtyFlags.get(userId);
  const payload: any = { type: 'serverTick', time };

  // Статы (money, bank) — всегда, лёгкий запрос
  try {
    const stats = await db.one('SELECT money, bank, COALESCE(auction_sales, 0) as auctionSales FROM users WHERE id = ?', [userId]) as any;
    if (stats) {
      payload.money = stats.money || 0;
      payload.bank = stats.bank || 0;
      payload.auctionSales = stats.auctionsales ?? stats.auctionSales ?? 0;
    }
  } catch {} // не критично

  if (flags && flags.size > 0) {
    if (flags.has('quests')) {
      const questData = await computeQuestData(userId);
      if (questData) payload.quests = questData;
      flags.delete('quests');
    }
    if (flags.has('rating')) {
      const ratingData = await computeRatingData(userId);
      if (ratingData) payload.rating = ratingData;
      flags.delete('rating');
    }
    if (flags.has('notifications')) {
      const queue = notificationQueues.get(userId);
      if (queue && queue.length > 0) {
        payload.notifications = queue.splice(0, queue.length);
      }
      flags.delete('notifications');
    }
    if (flags.size === 0) userDirtyFlags.delete(userId);
  }

  ws.send(JSON.stringify(payload));
}

export async function setupWebSocket(server: any) {
  const wss = new WebSocketServer({ server });

  // Интервал проверки живых соединений
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const alive = (ws as WebSocket & { isAlive?: boolean }).isAlive;
      if (alive === false) return ws.terminate();
      (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL * 1000);

  // Интервал serverTick — раз в секунду, персональные данные каждому пользователю
  const tickInterval = setInterval(() => {
    const time = Math.floor(Date.now() / 1000);
    // Отправляем персонально каждому (не broadcast — у каждого свои квесты/рейтинг/уведомления)
    clients.forEach((_, userId) => {
      sendServerTick(userId, time).catch(e => console.error('serverTick err:', e?.message));
    });
  }, 1000);

  wss.on('close', () => {
    clearInterval(interval);
    clearInterval(tickInterval);
  });

  // ---------- Подключение ----------
  wss.on("connection", async (ws: WebSocket, req) => {
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
      const admin = await db.one('SELECT id, username FROM admins WHERE id = ?', [decoded.adminId]);
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

      ws.on("message", async () => { });

      ws.on("close", async () => {
        clients.delete(adminId);
        userDirtyFlags.delete(adminId);
        notificationQueues.delete(adminId);
      });
      return;
    }

    // ---------- Игрок ----------
    const userId = decoded.userId;
    const user = await db.one(
      'SELECT u.id, u.username, u.level, u.chatBannedUntil, u.isGuest, g.name as guildName, u.guildId FROM users u LEFT JOIN guilds g ON u.guildId = g.id WHERE u.id = ?',
      [userId]
    );
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
    const onlineUser: OnlineUser = { id: user.id, username: user.username, level: user.level, guildName: user.guildName || null, guildId: user.guildId || null };
    onlineUsers.set(userId, onlineUser);
    auditWsConnect(user.username, user.id);

    // При подключении помечаем квесты + рейтинг — отправятся на первом же тике
    markDirty(userId, 'quests', 'rating');

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
    ws.on("message", async (raw) => {
      try {
      let data: any;
      try { data = JSON.parse(raw.toString()); } catch { return; }

      const currentUser = await db.one('SELECT chatBannedUntil FROM users WHERE id = ?', [userId]);
      if (currentUser && currentUser.chatBannedUntil && currentUser.chatBannedUntil > Math.floor(Date.now() / 1000)) {
        sendToUser(userId, {
          type: 'chatBanned',
          until: currentUser.chatBannedUntil,
        });
        return;
      }

      // Отправка предмета в чат
      if (data.type === 'itemLink') {
        const parsed = wsItemLinkSchema.safeParse(data);
        if (!parsed.success) return;
        let item = data.itemData;
        if (!item) {
          const itemId = data.itemId;
          if (!itemId) return;
          const userRow = await db.one('SELECT inventory FROM users WHERE id = ?', [userId]);
          const inventory = JSON.parse(userRow.inventory || '[]');
          item = inventory.find((i: any) => i.id == itemId);
        }
        if (!item) return;

        const itemDataJson = JSON.stringify(item);
        const itemName = sanitize(item.name);
        const info = await db.run(
          'INSERT INTO chat_messages (senderId, targetId, content, item_data) VALUES (?, NULL, ?, ?)',
          [userId, `[${itemName}]`, itemDataJson]
        );
        const msg = {
          id: info.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          senderGuild: user.guildName || null,
          senderGuildId: user.guildId || null,
          targetId: null,
          content: `[${itemName}]` || '',
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

          const targetUser = await db.one('SELECT id FROM users WHERE LOWER(username) = ?', [targetName]);
          if (!targetUser) {
            sendToUser(userId, { type: 'error', message: 'Пользователь не найден' });
            return;
          }
          if (targetUser.id === userId) {
            sendToUser(userId, { type: 'error', message: 'Нельзя отправить личное сообщение самому себе' });
            return;
          }

          const sanitizedPrivate = sanitize(privateContent);
          const info = await db.run(
            'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)',
            [userId, targetUser.id, sanitizedPrivate]
          );
          const msg = {
            id: info.lastInsertRowid,
            senderId: userId,
            senderName: user.username,
            targetId: targetUser.id,
            content: sanitizedPrivate || '',
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
        const info = await db.run(
          'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, NULL, ?)',
          [userId, sanitizedContent]
        );
        const msg = {
          id: info.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          senderGuild: user.guildName || null,
          senderGuildId: user.guildId || null,
          targetId: null,
          content: sanitizedContent || '',
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
        const info = await db.run(
          'INSERT INTO chat_messages (senderId, targetId, content) VALUES (?, ?, ?)',
          [userId, targetId, sanitizedContent]
        );
        const msg = {
          id: info.lastInsertRowid,
          senderId: userId,
          senderName: user.username,
          senderGuild: user.guildName || null,
          senderGuildId: user.guildId || null,
          targetId,
          content: sanitizedContent || '',
          createdAt: new Date().toISOString(),
        };
        sendToUser(userId, { type: 'message', message: msg });
        if (targetId !== userId) {
          sendToUser(targetId, { type: 'message', message: msg });
        }
      }
      } catch (e: any) { console.error('WS msg err:', e?.message || e); }
    });

    // ---------- Отключение ----------
    ws.on("close", async () => {
      clients.delete(userId);
      onlineUsers.delete(userId);
      userDirtyFlags.delete(userId);
      notificationQueues.delete(userId);
      auditWsDisconnect(user.username, userId);
      notifyUserOffline(userId);
    });
  });
}
