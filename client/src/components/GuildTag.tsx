import { useNavigate } from 'react-router-dom';

export default function GuildTag({ guildName, guildId, hideNoGuild }: { guildName?: string | null; guildId?: number | null; hideNoGuild?: boolean }) {
    const navigate = useNavigate();
    if (!guildName) return hideNoGuild ? null : <span className="text-[0.6rem] text-[var(--color-text-muted)]">[Без гильдии]</span>;
    const short = guildName.length > 10 ? guildName.slice(0, 10) + '…' : guildName;
    return (
        <span
            onClick={(e) => { e.stopPropagation(); if (guildId) navigate(`/guild/${guildId}`); }}
            className="text-[0.6rem] text-[var(--color-accent-success)] px-1 rounded cursor-pointer hover:underline"
            title={guildName}
        >[{short}]</span>
    );
}
