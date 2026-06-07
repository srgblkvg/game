interface ChatTabsProps {
  privateChatWith: number | null;
  openPrivateTabs: { id: number; name: string }[];
  guildChatActive: boolean;
  guildName?: string;
  onSelectPublic: () => void;
  onSelectPrivate: (id: number) => void;
  onSelectGuild: () => void;
  onCloseTab: (e: React.MouseEvent, id: number) => void;
}

export default function ChatTabs({ privateChatWith, openPrivateTabs, guildChatActive, guildName, onSelectPublic, onSelectPrivate, onSelectGuild, onCloseTab }: ChatTabsProps) {
  const maxNickLength = 12;
  const truncate = (nick: string) => nick.length > maxNickLength ? nick.slice(0, maxNickLength) + '...' : nick;

  const isPublic = privateChatWith === null && !guildChatActive;

  return (
    <div style={{ display: 'flex', background: '#1e1e30', borderBottom: '1px solid #444', overflowX: 'auto' }}>
      <div onClick={onSelectPublic} style={{
        padding: '0.3rem 0.6rem', cursor: 'pointer',
        background: isPublic ? '#333' : 'transparent',
        borderRight: '1px solid #444', whiteSpace: 'nowrap',
        fontWeight: isPublic ? 'bold' : 'normal', color: '#eee',
      }}>Общий</div>
      {guildName && (
        <div onClick={onSelectGuild} style={{
          padding: '0.3rem 0.6rem', cursor: 'pointer',
          background: guildChatActive ? '#333' : 'transparent',
          borderRight: '1px solid #444', whiteSpace: 'nowrap',
          fontWeight: guildChatActive ? 'bold' : 'normal',
          color: '#f1c40f', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          🏚️ {truncate(guildName)}
        </div>
      )}
      {openPrivateTabs.map(({ id, name }) => {
        const isActive = privateChatWith === id;
        return (
          <div key={id} onClick={() => onSelectPrivate(id)} style={{
            display: 'flex', alignItems: 'center', padding: '0.3rem 0.6rem',
            cursor: 'pointer', background: isActive ? '#333' : 'transparent',
            borderRight: '1px solid #444', whiteSpace: 'nowrap',
            fontWeight: isActive ? 'bold' : 'normal', color: '#c084fc',
          }}>
            <span>{truncate(name)}</span>
            <span
              onClick={(e) => onCloseTab(e, id)}
              style={{ marginLeft: '6px', fontWeight: 'bold', fontSize: '1.1rem', lineHeight: 1 }}
            >
              ×
            </span>
          </div>
        );
      })}
    </div>
  );
}
