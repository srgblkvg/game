interface ChatTabsProps {
  privateChatWith: number | null;
  openPrivateTabs: { id: number; name: string }[];
  guildChatActive: boolean;
  guildName?: string;
  unreadGeneral: number;
  unreadPrivate: Map<number, number>;
  unreadGuild: number;
  onSelectPublic: () => void;
  onSelectPrivate: (id: number) => void;
  onSelectGuild: () => void;
  onCloseTab: (e: React.MouseEvent, id: number) => void;
}

export default function ChatTabs({ privateChatWith, openPrivateTabs, guildChatActive, guildName, unreadGeneral, unreadPrivate, unreadGuild, onSelectPublic, onSelectPrivate, onSelectGuild, onCloseTab }: ChatTabsProps) {
  const maxNickLength = 12;
  const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '...' : nick;

  const isPublic = privateChatWith === null && !guildChatActive;

  return (
    <div className="flex bg-[var(--color-bg-secondary)] border-b border-[var(--color-border-default)] overflow-x-auto [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-[var(--color-border-light)] [&::-webkit-scrollbar-thumb]:rounded">
      <div onClick={onSelectPublic} className={`px-[0.6rem] py-[0.3rem] cursor-pointer border-r border-[var(--color-border-default)] whitespace-nowrap text-[var(--color-text-primary)] flex items-center gap-1 ${isPublic ? 'bg-[var(--color-bg-input)] font-bold' : 'bg-transparent font-normal'}`}>
        Общий
        {unreadGeneral > 0 && !isPublic && (
          <span className="w-2 h-2 rounded-full bg-white inline-block" />
        )}
      </div>
      {guildName && (
        <div onClick={onSelectGuild} className={`px-[0.6rem] py-[0.3rem] cursor-pointer border-r border-[var(--color-border-default)] whitespace-nowrap text-[var(--color-accent-success)] flex items-center gap-1 ${guildChatActive ? 'bg-[#1a3a1a] font-bold' : 'bg-transparent font-normal'}`}>
          🏚️ {truncate(guildName)}
          {unreadGuild > 0 && !guildChatActive && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent-success)] inline-block" />
          )}
        </div>
      )}
      {openPrivateTabs.map(({ id, name }) => {
        const isActive = privateChatWith === id;
        const pmUnread = unreadPrivate.get(id) || 0;
        return (
          <div key={id} onClick={() => onSelectPrivate(id)} className={`flex items-center px-[0.6rem] py-[0.3rem] cursor-pointer border-r border-[var(--color-border-default)] whitespace-nowrap text-[var(--color-accent-purple)] gap-1 ${isActive ? 'bg-[var(--color-bg-input)] font-bold' : 'bg-transparent font-normal'}`}>
            <span>{truncate(name)}</span>
            {pmUnread > 0 && !isActive && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-accent-purple)] inline-block" />
            )}
            <span
              onClick={(e) => onCloseTab(e, id)}
              className="ml-1.5 font-bold text-[1.1rem] leading-none"
            >
              ×
            </span>
          </div>
        );
      })}
    </div>
  );
}
