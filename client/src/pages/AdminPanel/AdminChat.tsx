import { useState, useEffect } from 'react';
import {
    fetchAdminMessages,
    deleteChatMessage,
    deleteAllChatMessages,
    banChatUser,
    fetchBannedUsers,
    unbanChatUser,
} from '../../api/chat';

export default function AdminChat() {
    const [messages, setMessages] = useState<any[]>([]);
    const [bannedUsers, setBannedUsers] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [deleteId, setDeleteId] = useState('');
    const [banUserId, setBanUserId] = useState('');
    const [banMinutes, setBanMinutes] = useState('60');

    const loadData = async () => {
        try {
            const [msgs, banned] = await Promise.all([
                fetchAdminMessages(),
                fetchBannedUsers(),
            ]);
            setMessages(msgs);
            setBannedUsers(banned);
        } catch (e: any) {
            setMessage(e.message);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDelete = async () => {
        try {
            await deleteChatMessage(parseInt(deleteId));
            setMessage('Сообщение удалено');
            loadData();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteAll = async () => {
        try {
            await deleteAllChatMessages();
            setMessage('Все сообщения удалены');
            loadData();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleBan = async () => {
        try {
            await banChatUser(parseInt(banUserId), parseInt(banMinutes));
            setMessage(`Игрок ${banUserId} заблокирован на ${banMinutes} мин`);
            loadData();
        } catch (e: any) { setMessage(e.message); }
    };

    const handleUnban = async (userId: number) => {
        try {
            await unbanChatUser(userId);
            setMessage(`Игрок ${userId} разбанен`);
            loadData();
        } catch (e: any) { setMessage(e.message); }
    };

    return (
        <div>
            <h3>Управление чатом</h3>

            {/* Блокировка */}
            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h4>Блокировка игрока</h4>
                <input type="number" placeholder="ID игрока" value={banUserId} onChange={e => setBanUserId(e.target.value)} style={{ marginRight: '0.5rem' }} />
                <input type="number" placeholder="Минут" value={banMinutes} onChange={e => setBanMinutes(e.target.value)} style={{ marginRight: '0.5rem', width: '80px' }} />
                <button onClick={handleBan} style={{ background: '#e67e22', border: 'none', color: '#fff', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>Заблокировать</button>
            </div>

            {/* Заблокированные */}
            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h4>Заблокированные игроки</h4>
                {bannedUsers.length === 0 ? (
                    <p>Нет заблокированных</p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid #444' }}>
                                <th>ID</th><th>Имя</th><th>До</th><th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {bannedUsers.map((u: any) => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #333' }}>
                                    <td>{u.id}</td>
                                    <td>{u.username}</td>
                                    <td>{new Date(u.chatBannedUntil * 1000).toLocaleString()}</td>
                                    <td>
                                        <button onClick={() => handleUnban(u.id)} style={{ background: '#2ecc71', border: 'none', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Разбанить</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Удаление */}
            <div style={{ marginBottom: '1rem', background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h4>Удаление</h4>
                <input type="number" placeholder="ID сообщения" value={deleteId} onChange={e => setDeleteId(e.target.value)} style={{ marginRight: '0.5rem' }} />
                <button onClick={handleDelete} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}>Удалить одно</button>
                <button onClick={handleDeleteAll} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '0.3rem 0.8rem', borderRadius: '4px', cursor: 'pointer' }}>Удалить все</button>
            </div>

            {message && <div style={{ margin: '1rem 0', color: '#2ecc71' }}>{message}</div>}

            {/* Сообщения */}
            <div style={{ background: '#1e1e30', padding: '1rem', borderRadius: '8px' }}>
                <h4>Последние сообщения</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #444' }}>
                            <th>ID</th><th>От</th><th>Кому</th><th>Текст</th><th>Время</th>
                        </tr>
                    </thead>
                    <tbody>
                        {messages.map((m: any) => (
                            <tr key={m.id} style={{ borderBottom: '1px solid #333' }}>
                                <td>{m.id}</td>
                                <td>{m.senderName} (ID {m.senderId})</td>
                                <td>{m.targetId ? `${m.targetName || 'ID ' + m.targetId}` : 'Общий'}</td>
                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.content}</td>
                                <td>{new Date(m.createdAt).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}