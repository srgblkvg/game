import { useState, useEffect } from 'react';
import {
    fetchAdminMessages, deleteChatMessage, deleteAllChatMessages,
    banChatUser, fetchBannedUsers, unbanChatUser, sendSystemMessage,
} from '../../api/chat';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { inputClass } from "../../utils/formStyles";
import { fmtSafeDate } from "../../utils/date";

export default function AdminChat() {
    const [messages, setMessages] = useState<any[]>([]);
    const [bannedUsers, setBannedUsers] = useState<any[]>([]);
    const [message, setMessage] = useState('');
    const [deleteId, setDeleteId] = useState('');
    const [banUserId, setBanUserId] = useState('');
    const [banMinutes, setBanMinutes] = useState('60');
    const [systemText, setSystemText] = useState('');
    const [msgPage, setMsgPage] = useState(1);
    const MSG_LIMIT = 10;
    const msgTotalPages = Math.ceil(messages.length / MSG_LIMIT);
    const pagedMsgs = messages.slice((msgPage - 1) * MSG_LIMIT, msgPage * MSG_LIMIT);

    const loadData = async () => {
        try {
            const [msgs, banned] = await Promise.all([fetchAdminMessages(), fetchBannedUsers()]);
            setMessages(msgs); setBannedUsers(banned);
        } catch (e: any) { setMessage(e.message); }
    };

    useEffect(() => { loadData(); }, []);

    const handleDelete = async () => {
        try { await deleteChatMessage(parseInt(deleteId)); setMessage('Сообщение удалено'); loadData(); }
        catch (e: any) { setMessage(e.message); }
    };

    const handleDeleteAll = async () => {
        try { await deleteAllChatMessages(); setMessage('Все сообщения удалены'); loadData(); }
        catch (e: any) { setMessage(e.message); }
    };

    const handleBan = async () => {
        try { await banChatUser(parseInt(banUserId), parseInt(banMinutes)); setMessage(`Игрок ${banUserId} заблокирован на ${banMinutes} мин`); loadData(); }
        catch (e: any) { setMessage(e.message); }
    };

    const handleUnban = async (userId: number) => {
        try { await unbanChatUser(userId); setMessage(`Игрок ${userId} разбанен`); loadData(); }
        catch (e: any) { setMessage(e.message); }
    };

    const handleSystemMessage = async () => {
        try { await sendSystemMessage(systemText); setMessage('Системное сообщение отправлено'); setSystemText(''); loadData(); }
        catch (e: any) { setMessage(e.message); }
    };

    return (
        <div>
            <h3 className="font-bold mb-3">Управление чатом</h3>

            <Card className="mb-4">
                <h4 className="font-bold mb-2">Блокировка игрока</h4>
                <label className="text-[0.6rem] text-[var(--color-text-muted)]">ID игрока</label>
                <input type="number" placeholder="ID игрока" value={banUserId} onChange={e => setBanUserId(e.target.value)} className={inputClass} />
                <input type="number" placeholder="Минут" value={banMinutes} onChange={e => setBanMinutes(e.target.value)} className={`${inputClass} w-20`} />
                <Button size="md" className="bg-[#e67e22]" onClick={handleBan}>Заблокировать</Button>
            </Card>

            <Card className="mb-4">
                <h4 className="font-bold mb-2">Заблокированные игроки</h4>
                {bannedUsers.length === 0 ? (
                    <p className="text-[var(--color-text-muted)]">Нет заблокированных</p>
                ) : (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1">ID</th><th className="text-left p-1">Имя</th><th className="text-left p-1">До</th><th className="text-left p-1"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {bannedUsers.map((u: any) => (
                                <tr key={u.id} className="border-b border-[var(--color-border-light)]">
                                    <td className="p-1">{u.id}</td>
                                    <td className="p-1">{u.username}</td>
                                    <td className="p-1">{fmtSafeDate(u.chatBannedUntil)}</td>
                                    <td className="p-1">
                                        <Button variant="success" size="md" onClick={() => handleUnban(u.id)}>Разбанить</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>

            <Card className="mb-4">
                <h4 className="font-bold mb-2">Системное сообщение</h4>
                <div className="flex gap-2">
                    <input type="text" placeholder="Текст сообщения в чат" value={systemText}
                        onChange={e => setSystemText(e.target.value)} className={inputClass}
                        onKeyDown={e => e.key === 'Enter' && handleSystemMessage()} />
                    <Button size="md" className="bg-[#8e44ad]" onClick={handleSystemMessage}>Отправить</Button>
                </div>
            </Card>

            <Card className="mb-4">
                <h4 className="font-bold mb-2">Удаление</h4>
                <label className="text-[0.6rem] text-[var(--color-text-muted)]">ID сообщения</label>
                <input type="number" placeholder="ID сообщения" value={deleteId} onChange={e => setDeleteId(e.target.value)} className={inputClass} />
                <Button variant="danger" size="md" className="mr-2" onClick={handleDelete}>Удалить одно</Button>
                <Button variant="danger" size="md" onClick={handleDeleteAll}>Удалить все</Button>
            </Card>

            {message && <p className="mb-4 text-[var(--color-accent-success)]">{message}</p>}

            <Card>
                <h4 className="font-bold mb-2">Последние сообщения</h4>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="border-b border-[var(--color-border-default)]">
                                <th className="text-left p-1">ID</th><th className="text-left p-1">От</th><th className="text-left p-1">Кому</th><th className="text-left p-1">Текст</th><th className="text-left p-1">Время</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedMsgs.map((m: any) => (
                                <tr key={m.id} className="border-b border-[var(--color-border-light)] cursor-pointer hover:bg-[var(--color-bg-hover)]"
                                    onClick={() => { setBanUserId(String(m.senderId)); setDeleteId(String(m.id)); }}
                                    title="Клик: заполнить ID отправителя и ID сообщения"
                                >
                                    <td className="p-1">{m.id}</td>
                                    <td className="p-1">{m.senderName} (ID {m.senderId})</td>
                                    <td className="p-1">{m.targetId ? `${m.targetName || 'ID ' + m.targetId}` : 'Общий'}</td>
                                    <td className="p-1 max-w-[200px] overflow-hidden text-ellipsis">{m.content}</td>
                                    <td className="p-1">{new Date(m.createdAt).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {msgTotalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-2">
                        <Button size="md" disabled={msgPage<=1} onClick={()=>setMsgPage(msgPage-1)}>←</Button>
                        <span className="text-xs text-[var(--color-text-muted)]">{msgPage}/{msgTotalPages}</span>
                        <Button size="md" disabled={msgPage>=msgTotalPages} onClick={()=>setMsgPage(msgPage+1)}>→</Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
