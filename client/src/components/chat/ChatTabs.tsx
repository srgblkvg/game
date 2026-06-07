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
    <div className="flex bg-[#1e1e30] border-b border-[#444] overflow-x-auto">
      <div onClick={onSelectPublic} className={`px-[0.6rem] py-[0.3rem] cursor-pointer border-r border-[#444] whitespace-nowrap text-[#eee] flex items-center gap-1 ${isPublic ? 'bg-[#333] font-bold' : 'bg-transparent font-normal'}`}>
        Общий
        {unreadGeneral > 0 && !isPublic && (
          <span className="w-2 h-2 rounded-full bg-white inline-block" />
        )}
      </div>
      {guildName && (
        <div onClick={onSelectGuild} className={`px-[0.6rem] py-[0.3rem] cursor-pointer border-r border-[#444] whitespace-nowrap text-[#2ecc71] flex items-center gap-1 ${guildChatActive ? 'bg-[#1a3a1a] font-bold' : 'bg-transparent font-normal'}`}>
          🏚️ {truncate(guildName)}
          {unreadGuild > 0 && !guildChatActive && (
            <span className="w-2 h-2 rounded-full bg-[#2ecc71] inline-block" />
          )}
        </div>
      )}
      {openPrivateTabs.map(({ id, name }) => {
        const isActive = privateChatWith === id;
        const pmUnread = unreadPrivate.get(id) || 0;
        return (
          <div key={id} onClick={() => onSelectPrivate(id)} className={`flex items-center px-[0.6rem] py-[0.3rem] cursor-pointer border-r border-[#444] whitespace-nowrap text-[#c084fc] gap-1 ${isActive ? 'bg-[#333] font-bold' : 'bg-transparent font-normal'}`}>
            <span>{truncate(name)}</span>
            {pmUnread > 0 && !isActive && (
              <span className="w-2 h-2 rounded-full bg-[#c084fc] inline-block" />
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
