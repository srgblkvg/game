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
        <div className="online-panel border-l border-[#444] overflow-y-auto p-2 pb-4 bg-[#16162a] max-h-full">
            <h4 className="mb-2 text-[0.85rem] text-[#2ecc71]">
                Онлайн ({users.length})
            </h4>
            <ul className="list-none p-0 m-0">
                {sorted.map(u => {
                    const isMe = u.id === currentUserId;
                    return (
                        <li
                            key={u.id}
                            onClick={isMe ? undefined : (e) => onUserClick(e, u.username, false)}
                            className={`py-[0.2rem] text-[0.8rem] whitespace-nowrap ${
                                isMe
                                    ? 'cursor-default text-[#f1c40f] font-normal'
                                    : privateChatWith === u.id
                                        ? 'cursor-pointer text-[#f1c40f] font-bold'
                                        : 'cursor-pointer text-[#2ecc71] font-normal'
                            }`}
                        >
                            {truncate(u.username)}
                            {isMe && ' (Вы)'}
                            {' '}[<span className="text-white">{u.level}</span>]
                            {u.guildName && <span className="text-[0.65rem] text-[#2ecc71] ml-1">[{u.guildName.length > 8 ? u.guildName.slice(0, 8) + '…' : u.guildName}]</span>}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
