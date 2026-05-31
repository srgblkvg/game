import type { OnlineUser } from './types';

interface OnlineListProps {
    users: OnlineUser[];
    currentUserId: number;
    privateChatWith: number | null;
    onUserClick: (e: React.MouseEvent, username: string, isSelf: boolean) => void;
}

export default function OnlineList({ users, currentUserId, privateChatWith, onUserClick }: OnlineListProps) {
    const sorted = users.slice().sort((a, b) => {
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        return 0;
    });

    const maxNickLength = 12;
    const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '…' : nick;

    return (
        <div className="online-panel" style={{
            borderLeft: '1px solid #444',
            overflowY: 'auto',
            padding: '0.5rem',
            background: '#16162a',
        }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#2ecc71' }}>
                Онлайн ({users.length})
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {sorted.map(u => {
                    const isMe = u.id === currentUserId;
                    return (
                        <li
                            key={u.id}
                            onClick={isMe ? undefined : (e) => onUserClick(e, u.username, false)}
                            style={{
                                cursor: isMe ? 'default' : 'pointer',
                                padding: '0.2rem 0',
                                color: isMe ? '#f1c40f' : (privateChatWith === u.id ? '#f1c40f' : '#2ecc71'),
                                fontWeight: isMe ? 'normal' : (privateChatWith === u.id ? 'bold' : 'normal'),
                                fontSize: '0.8rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {truncate(u.username)}
                            {isMe && ' (Вы)'}
                            {' '}[<span style={{ color: '#fff' }}>{u.level}</span>]
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}