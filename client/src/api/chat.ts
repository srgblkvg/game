import { BASE_URL, getHeaders } from './helpers';

export async function fetchRecentMessages(limit = 20) {
    const res = await fetch(`${BASE_URL}/chat/recent?limit=${limit}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки последних сообщений');
    return res.json();
}

export async function fetchPrivateMessages(userId: number) {
    const res = await fetch(`${BASE_URL}/chat/private/${userId}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки личных сообщений');
    return res.json();
}

// 🔍 Найти пользователя по точному нику
export async function findUserByUsername(username: string) {
    const res = await fetch(`${BASE_URL}/users/find?username=${encodeURIComponent(username)}`, {
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Пользователь не найден');
    return res.json();
}

// Все личные сообщения через список собеседников (для уведомлений)
export async function fetchAllPrivateMessagesNew() {
    const peersRes = await fetch(`${BASE_URL}/chat/private/peers`, { headers: getHeaders() });
    if (!peersRes.ok) throw new Error('Ошибка получения списка собеседников');
    const peers: { id: number; username: string }[] = await peersRes.json();

    const allMessages: any[] = [];
    for (const peer of peers) {
        try {
            const msgs = await fetchPrivateMessages(peer.id);
            allMessages.push(...msgs);
        } catch (e) { /* игнорируем ошибку для отдельного пользователя */ }
    }

    allMessages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return allMessages;
}

// Профиль
export async function fetchUserProfile(userId: number) {
  const res = await fetch(`${BASE_URL}/users/profile/${userId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Ошибка загрузки профиля');
  return res.json();
}

// ---------- Административные ----------

export async function fetchAdminMessages() {
    const res = await fetch(`${BASE_URL}/admin/chat/messages`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки сообщений');
    return res.json();
}

export async function deleteChatMessage(id: number) {
    const res = await fetch(`${BASE_URL}/admin/chat/messages/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления сообщения');
    return res.json();
}

export async function deleteAllChatMessages() {
    const res = await fetch(`${BASE_URL}/admin/chat/messages`, {
        method: 'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Ошибка удаления всех сообщений');
    return res.json();
}

export async function banChatUser(userId: number, minutes: number) {
    const res = await fetch(`${BASE_URL}/admin/chat/ban-chat`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId, minutes }),
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка блокировки');
    }
    return res.json();
}

export async function fetchBannedUsers() {
    const res = await fetch(`${BASE_URL}/admin/chat/banned`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Ошибка загрузки забаненных');
    return res.json();
}

export async function unbanChatUser(userId: number) {
    const res = await fetch(`${BASE_URL}/admin/chat/unban`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId }),
    });
    if (!res.ok) throw new Error('Ошибка снятия бана');
    return res.json();
}

export async function sendSystemMessage(content: string) {
    const res = await fetch(`${BASE_URL}/admin/chat/system-message`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Ошибка отправки сообщения');
    return res.json();
}