import { useGlobalChat } from '../../contexts/ChatContext';
import Card from '../../components/ui/Card';

export default function AdminOnline() {
    const { onlineUsers } = useGlobalChat();

    return (
        <div>
            <h2 className="text-lg font-bold mb-3">Игроки онлайн ({onlineUsers.length})</h2>
            {onlineUsers.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Нет игроков онлайн</p>
            ) : (
                <div className="space-y-1">
                    {onlineUsers.map((u: any) => (
                        <Card key={u.id} className="flex items-center gap-3 py-2 px-3">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-success)]" />
                            <span className="text-sm font-medium">{u.username}</span>
                            <span className="text-xs text-[var(--color-text-muted)]">ур.{u.level}</span>
                            {u.guildName && (
                                <span className="text-[0.6rem] text-[var(--color-accent-success)]">[{u.guildName}]</span>
                            )}
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
