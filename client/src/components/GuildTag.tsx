import { useNavigate } from 'react-router-dom';

export default function GuildTag({ guildName, guildId }: { guildName?: string | null; guildId?: number | null }) {
    const navigate = useNavigate();
    if (!guildName) return <span className="text-[0.6rem] text-[var(--color-text-muted)]">[Без гильдии]</span>;
    return (
        <span
            onClick={(e) => { e.stopPropagation(); if (guildId) navigate(`/guild/${guildId}`); }}
            className="text-[0.6rem] text-[#2ecc71] px-1 rounded cursor-pointer hover:underline"
        >[{guildName}]</span>
    );
}
